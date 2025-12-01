import { Client, Environment } from 'square'
import { adminDb } from '@/lib/firebaseAdmin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'

const accessToken = process.env.SQUARE_ACCESS_TOKEN
const locationId = process.env.SQUARE_LOCATION_ID

if (!accessToken || !locationId) {
  throw new Error('SQUARE_ACCESS_TOKEN ou SQUARE_LOCATION_ID manquant dans le .env.local')
}

const client = new Client({
  accessToken,
  environment: Environment.Production,
})

export async function syncVentesDepuisSquare(
  uid: string,
  chineurNom: string,
  startDateStr?: string,
  endDateStr?: string
) {
  console.log('🔄 Sync ventes pour', chineurNom)

  const chineuseSnap = await adminDb.collection('chineuse').doc(uid).get()
  if (!chineuseSnap.exists) {
    throw new Error(`Chineuse ${uid} non trouvée`)
  }

  const chineuseData = chineuseSnap.data()!
  const trigramme = chineuseData.trigramme || ''
  const categorieRapportLabel = chineuseData['Catégorie de rapport']?.[0]?.label?.toLowerCase() || ''

  // 1. Pré-charger TOUS les produits de cette chineuse une seule fois
  const produitsSnap = await adminDb.collection('produits')
    .where('chineurUid', '==', uid)
    .get()
  
  const produitsBySku = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  const produitsByCatalogId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  
  for (const doc of produitsSnap.docs) {
    const data = doc.data()
    if (data.sku) {
      produitsBySku.set(data.sku.toLowerCase(), doc)
    }
    if (data.catalogObjectId) {
      produitsByCatalogId.set(data.catalogObjectId, doc)
    }
    if (data.variationId) {
      produitsByCatalogId.set(data.variationId, doc)
    }
  }

  // 2. Pré-charger les ventes existantes pour éviter les doublons
  const ventesExistantes = new Set<string>()
  const ventesSnap = await adminDb.collection('ventes')
    .where('chineurUid', '==', uid)
    .get()
  
  for (const doc of ventesSnap.docs) {
    const data = doc.data()
    if (data.orderId && data.sku) {
      ventesExistantes.add(`${data.orderId}-${data.sku}`)
    }
    if (data.orderId && data.remarque) {
      ventesExistantes.add(`${data.orderId}-${data.remarque}`)
    }
  }

  // 3. Récupérer les commandes Square
  const startDate = startDateStr ? new Date(startDateStr) : undefined
  const endDate = endDateStr ? new Date(endDateStr) : undefined

  const filterSquare: any = {
    stateFilter: { states: ['COMPLETED'] },
  }
  if (startDate && endDate) {
    filterSquare.dateTimeFilter = {
      closedAt: {
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
      }
    }
  }

  const { result } = await client.ordersApi.searchOrders({
    locationIds: [locationId],
    query: { filter: filterSquare },
    sort: { sortField: 'CLOSED_AT', sortOrder: 'DESC' },
  })

  const orders = result.orders || []
  console.log(`📦 ${orders.length} commandes récupérées`)

  // 4. Collecter tous les catalogObjectIds uniques pour un seul appel batch
  const catalogIdsToFetch = new Set<string>()
  for (const order of orders) {
    for (const item of order.lineItems || []) {
      if (item.catalogObjectId && !produitsByCatalogId.has(item.catalogObjectId)) {
        catalogIdsToFetch.add(item.catalogObjectId)
      }
    }
  }

  // 5. Récupérer les SKUs en batch depuis Square (max 1000 par appel)
  const catalogIdToSku = new Map<string, string>()
  const catalogIdsArray = Array.from(catalogIdsToFetch)
  
  if (catalogIdsArray.length > 0) {
    for (let i = 0; i < catalogIdsArray.length; i += 100) {
      const batch = catalogIdsArray.slice(i, i + 100)
      try {
        const { result: batchResult } = await client.catalogApi.batchRetrieveCatalogObjects({
          objectIds: batch,
          includeRelatedObjects: false,
        })
        
        for (const obj of batchResult.objects || []) {
          if (obj.type === 'ITEM_VARIATION' && obj.itemVariationData?.sku) {
            catalogIdToSku.set(obj.id!, obj.itemVariationData.sku)
          }
        }
      } catch (err) {
        console.warn(`⚠️ Batch catalog fetch failed for some items`)
      }
    }
  }

  // 6. Traiter les commandes et collecter les opérations batch
  let nbSync = 0
  let nbNonAttribuees = 0
  let nbNotFound = 0

  const ventesToAdd: any[] = []
  const produitsToUpdate: { ref: FirebaseFirestore.DocumentReference; data: any }[] = []

  for (const order of orders) {
    for (const item of order.lineItems || []) {
      const itemName = item.name || ''
      const itemNote = item.note || order.note || ''
      const catalogObjectId = item.catalogObjectId
      const quantityVendue = parseInt(item.quantity) || 1
      
      const prixReelCents = item.totalMoney?.amount ?? null
      const prixReel = prixReelCents !== null
        ? Number(prixReelCents) / 100
        : null

      const isMontantPerso = itemName === 'Montant personnalisé' || !catalogObjectId

      let produitDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null
      let sku: string | null = null

      if (isMontantPerso) {
        const noteLower = itemNote.toLowerCase()
        const belongsToChineuse = 
          noteLower.includes(trigramme.toLowerCase()) ||
          (categorieRapportLabel && noteLower.startsWith(categorieRapportLabel.substring(0, 3)))
        
        if (!belongsToChineuse) continue

        const skuMatch = noteLower.match(/\b([a-z]{2,4})(\d{1,4})\b/i)
        if (skuMatch) {
          const potentialSku = skuMatch[0].toLowerCase()
          produitDoc = produitsBySku.get(potentialSku) || null
          
          if (!produitDoc && trigramme) {
            const skuAvecTri = `${trigramme.toLowerCase()}${skuMatch[2]}`
            produitDoc = produitsBySku.get(skuAvecTri) || null
          }
          
          if (produitDoc) {
            sku = produitDoc.data().sku
          }
        }
      } else {
        produitDoc = produitsByCatalogId.get(catalogObjectId!) || null
        
        if (!produitDoc) {
          const skuFromCatalog = catalogIdToSku.get(catalogObjectId!)
          if (skuFromCatalog) {
            produitDoc = produitsBySku.get(skuFromCatalog.toLowerCase()) || null
            
            if (!produitDoc && /^\d+$/.test(skuFromCatalog) && trigramme) {
              const skuAvecTri = `${trigramme.toLowerCase()}${skuFromCatalog}`
              produitDoc = produitsBySku.get(skuAvecTri) || null
            }
          }
        }
        
        if (produitDoc) {
          sku = produitDoc.data().sku
        }
      }

      // Vérifier doublon
      const dedupeKey = sku 
        ? `${order.id}-${sku}` 
        : `${order.id}-${itemNote}`
      
      if (ventesExistantes.has(dedupeKey)) {
        continue
      }
      ventesExistantes.add(dedupeKey)

      if (produitDoc) {
        const produitData = produitDoc.data()
        const quantiteActuelle = produitData.quantite || 1
        const nouvQuantite = Math.max(0, quantiteActuelle - quantityVendue)

        ventesToAdd.push({
          produitId: produitDoc.id,
          nom: produitData.nom,
          sku: produitData.sku,
          categorie: produitData.categorie,
          marque: produitData.marque || '',
          chineur: produitData.chineur,
          chineurUid: uid,
          categorieRapport: produitData.categorieRapport,
          trigramme: trigramme,
          prixInitial: produitData.prix,
          prixVenteReel: prixReel,
          dateVente: Timestamp.fromDate(new Date(order.closedAt!)),
          orderId: order.id,
          remarque: isMontantPerso ? itemNote : null,
          source: isMontantPerso ? 'montant_perso' : 'square',
          attribue: true,
          createdAt: Timestamp.now(),
        })

        const updateData: any = { quantite: nouvQuantite }
        if (nouvQuantite === 0) {
          updateData.vendu = true
          updateData.dateVente = Timestamp.fromDate(new Date(order.closedAt!))
          updateData.prixVenteReel = prixReel
        }
        produitsToUpdate.push({ ref: produitDoc.ref, data: updateData })
        
        nbSync++
      } else if (isMontantPerso) {
        ventesToAdd.push({
          produitId: null,
          nom: itemNote || 'Vente non attribuée',
          sku: null,
          categorie: null,
          marque: null,
          chineur: chineuseData.email || null,
          chineurUid: uid,
          categorieRapport: categorieRapportLabel || null,
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
        nbNonAttribuees++
      } else {
        console.warn(`❓ Produit non trouvé: ${itemName}`)
        nbNotFound++
      }
    }
  }

  // 7. Batch write Firestore (max 500 par batch)
  const BATCH_SIZE = 500
  
  // Écrire les ventes
  for (let i = 0; i < ventesToAdd.length; i += BATCH_SIZE) {
    const batch = adminDb.batch()
    const ventesChunk = ventesToAdd.slice(i, i + BATCH_SIZE)
    
    for (const vente of ventesChunk) {
      const ref = adminDb.collection('ventes').doc()
      batch.set(ref, vente)
    }
    
    await batch.commit()
  }

  // Mettre à jour les produits
  for (let i = 0; i < produitsToUpdate.length; i += BATCH_SIZE) {
    const batch = adminDb.batch()
    const produitsChunk = produitsToUpdate.slice(i, i + BATCH_SIZE)
    
    for (const { ref, data } of produitsChunk) {
      batch.update(ref, data)
    }
    
    await batch.commit()
  }

  console.log(`✅ ${chineurNom}: ${nbSync} sync, ${nbNonAttribuees} non attribuées`)
  return { 
    message: `${nbSync} ventes sync, ${nbNonAttribuees} à attribuer`,
    nbSync,
    nbNonAttribuees,
    nbNotFound
  }
}