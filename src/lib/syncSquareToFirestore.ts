import { Client, Environment } from 'square'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const accessToken = process.env.SQUARE_ACCESS_TOKEN
const locationId = process.env.SQUARE_LOCATION_ID

if (!accessToken || !locationId) {
  throw new Error('SQUARE_ACCESS_TOKEN ou SQUARE_LOCATION_ID manquant dans le .env.local')
}

const client = new Client({
  accessToken,
  environment: Environment.Production,
})

/**
 * Extrait le SKU depuis le catalogue Square ou Firebase
 */
async function extractSkuFromItem(
  item: any,
  adminDb: FirebaseFirestore.Firestore,
  uid: string,
  trigramme: string
): Promise<{ sku: string | null; produitDoc: FirebaseFirestore.QueryDocumentSnapshot | null }> {
  
  const catalogObjectId = item.catalogObjectId
  
  // 1. Essayer le catalogue Square (si produit pas supprimé)
  if (catalogObjectId) {
    try {
      const catalogRes = await client.catalogApi.retrieveCatalogObject(catalogObjectId, true)
      const catalogObj = catalogRes.result.object
      
      if (catalogObj?.type === 'ITEM_VARIATION' && catalogObj.itemVariationData?.sku) {
        const sku = catalogObj.itemVariationData.sku
        
        // Chercher dans Firebase par SKU
        let snap = await adminDb.collection('produits')
          .where('sku', '==', sku)
          .where('chineurUid', '==', uid)
          .get()
        
        // Si pas trouvé et SKU numérique, essayer avec trigramme
        if (snap.empty && /^\d+$/.test(sku) && trigramme) {
          snap = await adminDb.collection('produits')
            .where('sku', '==', `${trigramme}${sku}`)
            .where('chineurUid', '==', uid)
            .get()
        }
        
        if (!snap.empty) {
          return { sku, produitDoc: snap.docs[0] }
        }
      }
    } catch {
      // Produit supprimé du catalogue - on continue avec les autres méthodes
    }
  }
  
  // 2. Chercher par catalogObjectId stocké dans Firebase
  if (catalogObjectId) {
    const snapByCatalog = await adminDb.collection('produits')
      .where('catalogObjectId', '==', catalogObjectId)
      .where('chineurUid', '==', uid)
      .get()
    
    if (!snapByCatalog.empty) {
      const doc = snapByCatalog.docs[0]
      return { sku: doc.data().sku, produitDoc: doc }
    }
    
    const snapByVariation = await adminDb.collection('produits')
      .where('variationId', '==', catalogObjectId)
      .where('chineurUid', '==', uid)
      .get()
    
    if (!snapByVariation.empty) {
      const doc = snapByVariation.docs[0]
      return { sku: doc.data().sku, produitDoc: doc }
    }
  }
  
  // 3. Chercher par nom d'article (dernier recours)
  const itemName = item.name?.trim()
  if (itemName && itemName !== 'Montant personnalisé') {
    const allProduits = await adminDb.collection('produits')
      .where('chineurUid', '==', uid)
      .get()
    
    for (const doc of allProduits.docs) {
      const data = doc.data()
      const nomProduit = (data.nom || '').toLowerCase()
      const itemNameLower = itemName.toLowerCase()
      
      if (nomProduit.includes(itemNameLower) || itemNameLower.includes(nomProduit.replace(/^[a-z]+\d+\s*-\s*/i, ''))) {
        return { sku: data.sku, produitDoc: doc }
      }
    }
  }
  
  return { sku: null, produitDoc: null }
}

/**
 * Essaie de trouver un produit à partir de la remarque (note) de la vente
 * La remarque contient souvent le SKU ou une description du produit
 */
async function findProduitFromNote(
  note: string,
  adminDb: FirebaseFirestore.Firestore,
  uid: string,
  trigramme: string
): Promise<{ sku: string | null; produitDoc: FirebaseFirestore.QueryDocumentSnapshot | null }> {
  
  if (!note) return { sku: null, produitDoc: null }
  
  const noteLower = note.toLowerCase().trim()
  
  // 1. Chercher un SKU dans la remarque (ex: "pv31", "mis40", "gigi12")
  const skuMatch = noteLower.match(/\b([a-z]{2,4})(\d{1,4})\b/i)
  if (skuMatch) {
    const potentialSku = skuMatch[0].toUpperCase()
    
    let snap = await adminDb.collection('produits')
      .where('sku', '==', potentialSku)
      .where('chineurUid', '==', uid)
      .get()
    
    if (!snap.empty) {
      return { sku: potentialSku, produitDoc: snap.docs[0] }
    }
    
    // Essayer avec le trigramme de la chineuse
    if (trigramme) {
      const skuAvecTri = `${trigramme}${skuMatch[2]}`
      snap = await adminDb.collection('produits')
        .where('sku', '==', skuAvecTri)
        .where('chineurUid', '==', uid)
        .get()
      
      if (!snap.empty) {
        return { sku: skuAvecTri, produitDoc: snap.docs[0] }
      }
    }
  }
  
  return { sku: null, produitDoc: null }
}

export async function syncVentesDepuisSquare(
  uid: string,
  chineurNom: string,
  startDateStr?: string,
  endDateStr?: string
) {
  console.log('🔄 Début synchronisation ventes Square pour', chineurNom)

  const adminDb = getFirestore()
  
  const chineuseRef = adminDb.collection('chineuse').doc(uid)
  const chineuseSnap = await chineuseRef.get()

  if (!chineuseSnap.exists) {
    console.error(`❌ Chineuse ${uid} non trouvée dans Firestore`)
    throw new Error(`Chineuse ${uid} non trouvée dans Firestore`)
  }

  const chineuseData = chineuseSnap.data()!
  const trigramme = chineuseData.trigramme || ''
  
  // Récupérer le label de catégorie de rapport pour matcher les ventes "Montant personnalisé"
  const categorieRapportLabel = chineuseData['Catégorie de rapport']?.[0]?.label?.toLowerCase() || ''

  console.log('✅ Trigramme:', trigramme)
  console.log('✅ Catégorie rapport:', categorieRapportLabel)

  const startDate = startDateStr ? new Date(startDateStr) : undefined
  const endDate = endDateStr ? new Date(endDateStr) : undefined

  const dateTimeFilter = startDate && endDate ? {
    closedAt: {
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
    },
  } : null

  const filterSquare: any = {
    stateFilter: { states: ['COMPLETED'] },
  }
  if (dateTimeFilter) {
    filterSquare.dateTimeFilter = { closedAt: dateTimeFilter.closedAt }
    console.log('📅 Filtres de date appliqués:', filterSquare.dateTimeFilter)
  }

  try {
    const { result } = await client.ordersApi.searchOrders({
      locationIds: [locationId],
      query: {
        filter: filterSquare,
      },
      sort: { sortField: 'CLOSED_AT', sortOrder: 'DESC' },
    })

    const orders = result.orders || []
    console.log(`📦 Nombre total de commandes récupérées : ${orders.length}`)

    let nbSync = 0
    let nbNonAttribuees = 0
    let nbNotFound = 0

    for (const order of orders) {
      const lineItems = order.lineItems || []
      const orderNote = order.note || ''

      for (const item of lineItems) {
        const quantityVendue = parseInt(item.quantity) || 1
        const itemName = item.name || ''
        const itemNote = item.note || orderNote
        
        const prixReelCents = item.totalMoney?.amount ?? null
        let prixReel = null
        if (prixReelCents !== null) {
          prixReel = typeof prixReelCents === 'bigint'
            ? Number(prixReelCents) / 100
            : Number(prixReelCents) / 100
        }

        // Vérifier si c'est un "Montant personnalisé"
        const isMontantPerso = itemName === 'Montant personnalisé' || !item.catalogObjectId
        
        let sku: string | null = null
        let produitDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null

        if (isMontantPerso) {
          // Vérifier si la remarque concerne cette chineuse (trigramme ou nom dans la note)
          const noteLower = itemNote.toLowerCase()
          const belongsToChineuse = 
            noteLower.includes(trigramme.toLowerCase()) ||
            (categorieRapportLabel && noteLower.startsWith(categorieRapportLabel.substring(0, 3)))
          
          if (!belongsToChineuse) {
            continue // Cette vente n'est pas pour cette chineuse
          }
          
          // Essayer de trouver le produit depuis la remarque
          const result = await findProduitFromNote(itemNote, adminDb, uid, trigramme)
          sku = result.sku
          produitDoc = result.produitDoc
          
        } else {
          // Vente normale avec catalogObjectId
          const result = await extractSkuFromItem(item, adminDb, uid, trigramme)
          sku = result.sku
          produitDoc = result.produitDoc
        }

        // Vérifier si cette vente n'a pas déjà été importée
        const existingVente = await adminDb.collection('ventes')
          .where('orderId', '==', order.id)
          .where('chineurUid', '==', uid)
          .get()
        
        // Chercher plus précisément par montant et date si pas d'orderId match exact
        const alreadyExists = existingVente.docs.some(doc => {
          const data = doc.data()
          return data.prixVenteReel === prixReel && 
                 (data.sku === sku || (!data.sku && !sku && data.remarque === itemNote))
        })
        
        if (alreadyExists) {
          console.log(`⏭️ Vente déjà importée: ${sku || itemNote}`)
          continue
        }

        if (produitDoc) {
          // Vente attribuée à un produit
          const produitData = produitDoc.data()
          const quantiteActuelle = produitData.quantite || 1
          const nouvQuantite = Math.max(0, quantiteActuelle - quantityVendue)

          await adminDb.collection('ventes').add({
            produitId: produitDoc.id,
            nom: produitData.nom,
            sku: produitData.sku,
            categorie: produitData.categorie,
            marque: produitData.marque || '',
            chineur: produitData.chineur,
            chineurUid: produitData.chineurUid,
            categorieRapport: produitData.categorieRapport,
            trigramme: produitData.trigramme,
            prixInitial: produitData.prix,
            prixVenteReel: prixReel,
            dateVente: Timestamp.fromDate(new Date(order.closedAt!)),
            orderId: order.id,
            remarque: isMontantPerso ? itemNote : null,
            source: isMontantPerso ? 'montant_perso' : 'square',
            createdAt: Timestamp.now(),
          })

          // Mise à jour du produit
          const updateData: any = { quantite: nouvQuantite }
          if (nouvQuantite === 0) {
            updateData.vendu = true
            updateData.dateVente = Timestamp.fromDate(new Date(order.closedAt!))
            updateData.prixVenteReel = prixReel
          }

          await produitDoc.ref.update(updateData)
          
          console.log(`✅ Vente sync: ${produitData.sku}`, { isMontantPerso })
          nbSync++
          
        } else if (isMontantPerso) {
          // Vente "Montant personnalisé" non attribuée - on la stocke quand même
          await adminDb.collection('ventes').add({
            produitId: null,
            nom: itemNote || 'Vente non attribuée',
            sku: null,
            categorie: null,
            marque: null,
            chineur: chineuseData.email || null,
            chineurUid: uid,
            categorieRapport: chineuseData['Catégorie de rapport']?.[0]?.label || null,
            trigramme: trigramme,
            prixInitial: null,
            prixVenteReel: prixReel,
            dateVente: Timestamp.fromDate(new Date(order.closedAt!)),
            orderId: order.id,
            remarque: itemNote,
            source: 'montant_perso_non_attribue',
            attribue: false,
            createdAt: Timestamp.now(),
          })
          
          console.log(`⚠️ Vente non attribuée stockée: ${itemNote} (${prixReel}€)`)
          nbNonAttribuees++
          
        } else {
          console.warn(`❓ Produit non trouvé: ${itemName}`)
          nbNotFound++
        }
      }
    }

    console.log(`🎉 Terminé — ${nbSync} sync, ${nbNonAttribuees} non attribuées, ${nbNotFound} non trouvés.`)
    return { 
      message: `${nbSync} ventes synchronisées, ${nbNonAttribuees} ventes à attribuer manuellement.`,
      nbSync,
      nbNonAttribuees,
      nbNotFound
    }
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation :', error)
    throw error
  }
}