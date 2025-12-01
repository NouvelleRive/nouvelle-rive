// lib/syncSquareToFirestore.ts
import { Client, Environment } from 'square'
import { adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

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
 * Sync TOUTES les ventes Square d'une période
 * 1. Récupère toutes les commandes Square
 * 2. Pour chaque article vendu, cherche le produit par SKU
 * 3. Si trouvé → vente attribuée avec toutes les infos
 * 4. Si pas trouvé → vente non attribuée (à matcher manuellement)
 */
export async function syncVentesDepuisSquare(
  startDateStr?: string,
  endDateStr?: string
) {
  console.log('🔄 Sync TOUTES les ventes Square')
  console.log(`📅 Période: ${startDateStr || 'début'} → ${endDateStr || 'maintenant'}`)

  // 1. Pré-charger TOUS les produits (index par SKU et catalogObjectId)
  const produitsSnap = await adminDb.collection('produits').get()
  
  const produitsBySku = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  const produitsByCatalogId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  
  for (const doc of produitsSnap.docs) {
    const data = doc.data()
    if (data.sku) {
      // Index par SKU (en minuscule pour matching insensible à la casse)
      produitsBySku.set(data.sku.toLowerCase(), doc)
      
      // Index aussi par SKU sans trigramme (ex: "28" pour "DM28")
      const skuSansTrigramme = data.sku.replace(/^[a-zA-Z]+/, '')
      if (skuSansTrigramme) {
        // On garde le trigramme pour retrouver le bon produit
        const key = `${data.trigramme?.toLowerCase() || ''}-${skuSansTrigramme}`
        produitsBySku.set(key, doc)
      }
    }
    if (data.catalogObjectId) {
      produitsByCatalogId.set(data.catalogObjectId, doc)
    }
    if (data.variationId) {
      produitsByCatalogId.set(data.variationId, doc)
    }
  }
  
  console.log(`📦 ${produitsSnap.docs.length} produits indexés`)

  // 2. Pré-charger les ventes existantes pour déduplication (par orderId + index ligne)
  const ventesExistantes = new Set<string>()
  const ventesSnap = await adminDb.collection('ventes').get()
  
  for (const doc of ventesSnap.docs) {
    const data = doc.data()
    if (data.orderId) {
      // Clé unique: orderId + lineItemUid OU orderId + nom
      if (data.lineItemUid) {
        ventesExistantes.add(`${data.orderId}-${data.lineItemUid}`)
      }
      // Fallback sur nom/remarque pour les anciennes ventes
      const itemKey = data.sku || data.nom || data.remarque
      if (itemKey) {
        ventesExistantes.add(`${data.orderId}-${itemKey}`)
      }
    }
  }
  
  console.log(`📋 ${ventesExistantes.size} ventes existantes (pour dédup)`)

  // 3. Récupérer les commandes Square
  const startDate = startDateStr ? new Date(startDateStr) : undefined
  const endDate = endDateStr ? new Date(endDateStr) : undefined
  
  // Si pas de date de fin, prendre maintenant
  const effectiveEndDate = endDate ? new Date(endDate) : new Date()
  // Ajouter 1 jour à la fin pour inclure toute la journée
  effectiveEndDate.setDate(effectiveEndDate.getDate() + 1)

  const filterSquare: any = {
    stateFilter: { states: ['COMPLETED'] },
  }
  
  if (startDate) {
    filterSquare.dateTimeFilter = {
      closedAt: {
        startAt: startDate.toISOString(),
        endAt: effectiveEndDate.toISOString(),
      }
    }
  }

  let allOrders: any[] = []
  let cursor: string | undefined = undefined

  // Pagination pour récupérer toutes les commandes
  do {
    const { result } = await client.ordersApi.searchOrders({
      locationIds: [locationId],
      query: { filter: filterSquare },
      cursor,
      limit: 100,
    })
    
    allOrders = allOrders.concat(result.orders || [])
    cursor = result.cursor
    
    console.log(`📥 ${allOrders.length} commandes récupérées...`)
  } while (cursor)

  console.log(`📦 Total: ${allOrders.length} commandes Square`)

  // 4. Collecter les catalogObjectIds pour récupérer les SKUs en batch
  const catalogIdsToFetch = new Set<string>()
  for (const order of allOrders) {
    for (const item of order.lineItems || []) {
      if (item.catalogObjectId && !produitsByCatalogId.has(item.catalogObjectId)) {
        catalogIdsToFetch.add(item.catalogObjectId)
      }
    }
  }

  // 5. Récupérer les SKUs depuis Square Catalog en batch
  const catalogIdToSku = new Map<string, string>()
  const catalogIdsArray = Array.from(catalogIdsToFetch)
  
  if (catalogIdsArray.length > 0) {
    console.log(`🔍 Récupération de ${catalogIdsArray.length} SKUs depuis Square...`)
    
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
        console.warn(`⚠️ Erreur batch catalog:`, err)
      }
    }
    
    console.log(`✅ ${catalogIdToSku.size} SKUs récupérés depuis Square`)
  }

  // 6. Traiter chaque commande et créer les ventes
  let nbImported = 0
  let nbAttribuees = 0
  let nbNonAttribuees = 0
  let nbSkipped = 0

  const ventesToAdd: any[] = []
  const produitsToUpdate: { ref: FirebaseFirestore.DocumentReference; data: any }[] = []

  for (const order of allOrders) {
    const orderDate = order.closedAt ? new Date(order.closedAt) : new Date()
    
    for (const item of order.lineItems || []) {
      const lineItemUid = item.uid
      const itemName = item.name || ''
      const itemNote = item.note || ''
      const orderNote = order.note || ''
      const catalogObjectId = item.catalogObjectId
      const quantityVendue = parseInt(item.quantity) || 1
      
      const prixReelCents = item.totalMoney?.amount ?? null
      const prixReel = prixReelCents !== null ? Number(prixReelCents) / 100 : null

      // Vérifier doublon
      const dedupeKey1 = `${order.id}-${lineItemUid}`
      const dedupeKey2 = `${order.id}-${itemName}`
      
      if (ventesExistantes.has(dedupeKey1) || ventesExistantes.has(dedupeKey2)) {
        nbSkipped++
        continue
      }
      
      // Ajouter aux clés pour éviter doublons dans ce batch
      ventesExistantes.add(dedupeKey1)
      ventesExistantes.add(dedupeKey2)

      // Chercher le produit correspondant
      let produitDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null
      let matchedSku: string | null = null
      let matchMethod: string = 'none'

      // Méthode 1: Par catalogObjectId
      if (catalogObjectId) {
        produitDoc = produitsByCatalogId.get(catalogObjectId) || null
        if (produitDoc) {
          matchMethod = 'catalogId'
          matchedSku = produitDoc.data().sku
        }
      }

      // Méthode 2: Par SKU du catalogue Square
      if (!produitDoc && catalogObjectId) {
        const skuFromSquare = catalogIdToSku.get(catalogObjectId)
        if (skuFromSquare) {
          produitDoc = produitsBySku.get(skuFromSquare.toLowerCase()) || null
          if (produitDoc) {
            matchMethod = 'skuCatalog'
            matchedSku = produitDoc.data().sku
          }
        }
      }

      // Méthode 3: Extraire SKU du nom de l'article (ex: "DM28 - Veste cuir")
      if (!produitDoc) {
        const skuMatch = itemName.match(/^([A-Za-z]{2,4}\d{1,4})/i)
        if (skuMatch) {
          const potentialSku = skuMatch[1].toLowerCase()
          produitDoc = produitsBySku.get(potentialSku) || null
          if (produitDoc) {
            matchMethod = 'skuFromName'
            matchedSku = produitDoc.data().sku
          }
        }
      }

      // Méthode 4: Extraire SKU de la note (montant personnalisé)
      if (!produitDoc && (itemNote || orderNote)) {
        const noteToSearch = `${itemNote} ${orderNote}`.toLowerCase()
        const skuMatch = noteToSearch.match(/\b([a-z]{2,4})(\d{1,4})\b/i)
        if (skuMatch) {
          const potentialSku = skuMatch[0].toLowerCase()
          produitDoc = produitsBySku.get(potentialSku) || null
          if (produitDoc) {
            matchMethod = 'skuFromNote'
            matchedSku = produitDoc.data().sku
          }
        }
      }

      // Créer la vente
      const venteData: any = {
        // Identifiants Square
        orderId: order.id,
        lineItemUid: lineItemUid,
        catalogObjectId: catalogObjectId || null,
        
        // Infos vente
        prixVenteReel: prixReel,
        dateVente: Timestamp.fromDate(orderDate),
        quantite: quantityVendue,
        
        // Nom affiché (pour faciliter l'identification)
        nomSquare: itemName,
        remarque: itemNote || orderNote || null,
        
        // Source
        source: catalogObjectId ? 'square' : 'montant_perso',
        createdAt: Timestamp.now(),
      }

      if (produitDoc) {
        // Vente attribuée
        const produitData = produitDoc.data()
        
        venteData.produitId = produitDoc.id
        venteData.nom = produitData.nom
        venteData.sku = produitData.sku
        venteData.categorie = produitData.categorie
        venteData.marque = produitData.marque || ''
        venteData.chineur = produitData.chineur
        venteData.chineurUid = produitData.chineurUid
        venteData.trigramme = produitData.trigramme
        venteData.categorieRapport = produitData.categorieRapport
        venteData.prixInitial = produitData.prix
        venteData.attribue = true
        venteData.matchMethod = matchMethod
        
        // Mettre à jour le produit (décrémenter stock)
        const quantiteActuelle = produitData.quantite || 1
        const nouvQuantite = Math.max(0, quantiteActuelle - quantityVendue)
        
        const updateData: any = { quantite: nouvQuantite }
        if (nouvQuantite === 0) {
          updateData.vendu = true
          updateData.dateVente = Timestamp.fromDate(orderDate)
          updateData.prixVenteReel = prixReel
        }
        
        produitsToUpdate.push({ ref: produitDoc.ref, data: updateData })
        nbAttribuees++
      } else {
        // Vente non attribuée
        venteData.produitId = null
        venteData.nom = itemName || itemNote || orderNote || 'Vente inconnue'
        venteData.sku = null
        venteData.chineurUid = null
        venteData.trigramme = null
        venteData.attribue = false
        
        nbNonAttribuees++
      }

      ventesToAdd.push(venteData)
      nbImported++
    }
  }

  // 7. Batch write Firestore
  const BATCH_SIZE = 500
  
  // Écrire les ventes
  for (let i = 0; i < ventesToAdd.length; i += BATCH_SIZE) {
    const batch = adminDb.batch()
    const chunk = ventesToAdd.slice(i, i + BATCH_SIZE)
    
    for (const vente of chunk) {
      const ref = adminDb.collection('ventes').doc()
      batch.set(ref, vente)
    }
    
    await batch.commit()
    console.log(`💾 ${Math.min(i + BATCH_SIZE, ventesToAdd.length)}/${ventesToAdd.length} ventes écrites`)
  }

  // Mettre à jour les produits
  for (let i = 0; i < produitsToUpdate.length; i += BATCH_SIZE) {
    const batch = adminDb.batch()
    const chunk = produitsToUpdate.slice(i, i + BATCH_SIZE)
    
    for (const { ref, data } of chunk) {
      batch.update(ref, data)
    }
    
    await batch.commit()
  }

  console.log(`✅ Sync terminé:`)
  console.log(`   - ${nbImported} ventes importées`)
  console.log(`   - ${nbAttribuees} attribuées automatiquement`)
  console.log(`   - ${nbNonAttribuees} à attribuer manuellement`)
  console.log(`   - ${nbSkipped} doublons ignorés`)

  return {
    success: true,
    message: `${nbImported} ventes importées (${nbAttribuees} attribuées, ${nbNonAttribuees} à attribuer)`,
    nbImported,
    nbAttribuees,
    nbNonAttribuees,
    nbSkipped,
  }
}