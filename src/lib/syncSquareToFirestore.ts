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
 * Extrait le SKU depuis le nom de l'article ou le catalogue Square
 * Stratégie :
 * 1. Essayer de récupérer depuis le catalogue (si produit existe encore)
 * 2. Sinon, chercher dans Firebase par nom d'article
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
  
  // 2. Chercher par catalogObjectId stocké dans Firebase (ancien produit)
  if (catalogObjectId) {
    const snapByCatalog = await adminDb.collection('produits')
      .where('catalogObjectId', '==', catalogObjectId)
      .where('chineurUid', '==', uid)
      .get()
    
    if (!snapByCatalog.empty) {
      const doc = snapByCatalog.docs[0]
      return { sku: doc.data().sku, produitDoc: doc }
    }
    
    // Essayer aussi avec variationId
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
  if (itemName) {
    // Chercher un produit dont le nom contient le nom de l'article
    const allProduits = await adminDb.collection('produits')
      .where('chineurUid', '==', uid)
      .get()
    
    for (const doc of allProduits.docs) {
      const data = doc.data()
      const nomProduit = (data.nom || '').toLowerCase()
      const itemNameLower = itemName.toLowerCase()
      
      // Match si le nom du produit contient le nom de l'article ou vice versa
      if (nomProduit.includes(itemNameLower) || itemNameLower.includes(nomProduit.replace(/^[a-z]+\d+\s*-\s*/i, ''))) {
        return { sku: data.sku, produitDoc: doc }
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

  // Récupérer les catégories autorisées pour filtrer les ventes
  const categoriesFirestore = Array.isArray(chineuseData?.Catégorie)
    ? chineuseData.Catégorie
    : []
  const categoriesIds = categoriesFirestore
    .map((cat: any) => cat?.idsquare)
    .filter((id: any) => typeof id === 'string' && id.length > 0)

  console.log('✅ Trigramme:', trigramme)
  console.log('📂 Catégories autorisées:', categoriesIds.length)

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
    let nbNotFound = 0

    for (const order of orders) {
      const lineItems = order.lineItems || []

      for (const item of lineItems) {
        const quantityVendue = parseInt(item.quantity) || 1
        
        // Extraire le SKU et trouver le produit
        const { sku, produitDoc } = await extractSkuFromItem(item, adminDb, uid, trigramme)
        
        if (!produitDoc) {
          console.warn(`⚠️ Produit non trouvé pour: ${item.name}`)
          nbNotFound++
          continue
        }

        const produitData = produitDoc.data()
        
        // Vérifier si cette vente n'a pas déjà été importée (éviter les doublons)
        const existingVente = await adminDb.collection('ventes')
          .where('orderId', '==', order.id)
          .where('sku', '==', produitData.sku)
          .get()
        
        if (!existingVente.empty) {
          console.log(`⏭️ Vente déjà importée: ${produitData.sku} (order ${order.id})`)
          continue
        }

        const quantiteActuelle = produitData.quantite || 1
        const nouvQuantite = Math.max(0, quantiteActuelle - quantityVendue)

        const prixReelCents = item.totalMoney?.amount ?? null
        let prixReel = null

        if (prixReelCents !== null) {
          prixReel = typeof prixReelCents === 'bigint'
            ? Number(prixReelCents) / 100
            : Number(prixReelCents) / 100
        }

        // Créer une ligne dans la collection "ventes"
        for (let i = 0; i < quantityVendue; i++) {
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
            prixVenteReel: prixReel ? prixReel / quantityVendue : null,
            dateVente: Timestamp.fromDate(new Date(order.closedAt!)),
            orderId: order.id,
            createdAt: Timestamp.now(),
          })
        }

        // Mise à jour du produit
        const updateData: any = {
          quantite: nouvQuantite,
        }

        if (nouvQuantite === 0) {
          updateData.vendu = true
          updateData.dateVente = Timestamp.fromDate(new Date(order.closedAt!))
          updateData.prixVenteReel = prixReel
        }

        console.log(`✅ Vente sync: ${produitData.sku} (${item.name})`, {
          quantiteAvant: quantiteActuelle,
          quantiteApres: nouvQuantite,
        })

        await produitDoc.ref.update(updateData)
        nbSync++
      }
    }

    console.log(`🎉 Terminé — ${nbSync} ventes sync, ${nbNotFound} non trouvés.`)
    return { message: `${nbSync} ventes synchronisées, ${nbNotFound} produits non trouvés.` }
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation :', error)
    throw error
  }
}