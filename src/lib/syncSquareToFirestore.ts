// lib/syncSquareToFirestore.ts
import { Client, Environment } from 'square'
import { adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: Environment.Production,
})

const locationId = process.env.SQUARE_LOCATION_ID!

/**
 * Sync TOUTES les ventes Square d'une période
 * Match par SKU uniquement
 * Déduplication par orderId+lineItemUid ET par prix+date
 */
export async function syncVentesDepuisSquare(
  startDateStr?: string,
  endDateStr?: string
) {
  console.log('🔄 Sync ventes Square')
  console.log(`📅 Période: ${startDateStr || 'début'} → ${endDateStr || 'maintenant'}`)

  // 1. Charger tous les produits Firestore, indexés par SKU
  const produitsSnap = await adminDb.collection('produits').get()
  const produitsBySku = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  
  for (const doc of produitsSnap.docs) {
    const data = doc.data()
    if (data.sku) {
      // Index par SKU normalisé (minuscule, sans espaces)
      const skuNorm = data.sku.toLowerCase().replace(/\s+/g, '')
      produitsBySku.set(skuNorm, doc)
    }
  }
  console.log(`📦 ${produitsBySku.size} produits indexés par SKU`)

  // 2. Charger ventes existantes pour déduplication AMÉLIORÉE
  const ventesExistantes = new Set<string>()
  const ventesSnap = await adminDb.collection('ventes').get()
  
  for (const doc of ventesSnap.docs) {
    const data = doc.data()
    
    // Clé 1: orderId + lineItemUid (pour ventes Square avec catalogObjectId)
    if (data.orderId && data.lineItemUid) {
      ventesExistantes.add(`order-${data.orderId}-${data.lineItemUid}`)
    }
    
    // Clé 2: prix + date arrondie à la minute (pour montant_perso et ventes attribuées)
    // Ceci évite les doublons même si le nom a changé après attribution
    if (data.prixVenteReel && data.dateVente) {
      const dateObj = data.dateVente.toDate ? data.dateVente.toDate() : new Date(data.dateVente)
      const dateMin = Math.floor(dateObj.getTime() / 60000) // Arrondi à la minute
      ventesExistantes.add(`prix-${data.prixVenteReel}-${dateMin}`)
    }
  }
  console.log(`📋 ${ventesExistantes.size} clés de déduplication (ventes existantes)`)

  // 3. Récupérer commandes Square
  const startDate = startDateStr ? new Date(startDateStr) : undefined
  const endDate = endDateStr ? new Date(endDateStr) : new Date()
  endDate.setDate(endDate.getDate() + 1) // Inclure toute la journée

  const filter: any = { stateFilter: { states: ['COMPLETED'] } }
  if (startDate) {
    filter.dateTimeFilter = {
      closedAt: {
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
      }
    }
  }

  let allOrders: any[] = []
  let cursor: string | undefined

  do {
    const { result } = await client.ordersApi.searchOrders({
      locationIds: [locationId],
      query: { filter },
      cursor,
      limit: 100,
    })
    allOrders = allOrders.concat(result.orders || [])
    cursor = result.cursor
  } while (cursor)

  console.log(`📥 ${allOrders.length} commandes Square`)

  // 4. Récupérer les SKUs depuis Square Catalog pour les articles avec catalogObjectId
  const catalogIds = new Set<string>()
  for (const order of allOrders) {
    for (const item of order.lineItems || []) {
      if (item.catalogObjectId) {
        catalogIds.add(item.catalogObjectId)
      }
    }
  }

  const catalogIdToSku = new Map<string, string>()
  const catalogIdsArray = Array.from(catalogIds)
  
  console.log(`🔍 ${catalogIdsArray.length} catalogObjectIds à récupérer`)
  
  for (let i = 0; i < catalogIdsArray.length; i += 100) {
    const batch = catalogIdsArray.slice(i, i + 100)
    try {
      const { result } = await client.catalogApi.batchRetrieveCatalogObjects({
        objectIds: batch,
        includeRelatedObjects: true,
      })
      
      // Récupérer SKU depuis les objets principaux
      for (const obj of result.objects || []) {
        let sku: string | null = null
        
        if (obj.type === 'ITEM_VARIATION' && obj.itemVariationData?.sku) {
          sku = obj.itemVariationData.sku
        } else if (obj.type === 'ITEM' && obj.itemData?.variations?.[0]?.itemVariationData?.sku) {
          sku = obj.itemData.variations[0].itemVariationData.sku
        }
        
        if (sku) {
          catalogIdToSku.set(obj.id!, sku)
          console.log(`  ✅ ${obj.id} (${obj.type}) → SKU: ${sku}`)
        }
      }
      
      // Récupérer SKU depuis les objets liés (variations)
      for (const obj of result.relatedObjects || []) {
        if (obj.type === 'ITEM_VARIATION' && obj.itemVariationData?.sku) {
          catalogIdToSku.set(obj.id!, obj.itemVariationData.sku)
          console.log(`  ✅ ${obj.id} (related) → SKU: ${obj.itemVariationData.sku}`)
        }
      }
    } catch (err) {
      console.warn('Erreur catalog batch:', err)
    }
  }
  console.log(`🏷️ ${catalogIdToSku.size} SKUs récupérés du catalogue Square`)

  // 5. Traiter chaque vente
  let nbImported = 0
  let nbAttribuees = 0
  let nbNonAttribuees = 0
  let nbSkipped = 0

  const ventesToAdd: any[] = []
  const produitsToUpdate: { ref: FirebaseFirestore.DocumentReference; data: any }[] = []

  for (const order of allOrders) {
    const orderDate = order.closedAt ? new Date(order.closedAt) : new Date()
    const orderNote = order.note || ''
    // Les remarques peuvent être dans différents champs
    const orderSource = order.source?.name || ''
    const orderReferenceId = order.referenceId || ''
    const orderTicketName = order.ticketName || ''

    for (const item of order.lineItems || []) {
      const lineItemUid = item.uid
      const prixCents = item.totalMoney?.amount
      const prix = prixCents ? Number(prixCents) / 100 : null

      // Clé de déduplication 1: orderId + lineItemUid
      const dedupeKeyOrder = `order-${order.id}-${lineItemUid}`
      
      // Clé de déduplication 2: prix + date arrondie à la minute
      const dateMin = Math.floor(orderDate.getTime() / 60000)
      const dedupeKeyPrix = `prix-${prix}-${dateMin}`

      // Skip si déjà importé (par l'une ou l'autre clé)
      if (ventesExistantes.has(dedupeKeyOrder) || ventesExistantes.has(dedupeKeyPrix)) {
        nbSkipped++
        continue
      }
      
      // Ajouter les deux clés pour éviter les doublons dans le même batch
      ventesExistantes.add(dedupeKeyOrder)
      ventesExistantes.add(dedupeKeyPrix)

      const itemName = item.name || ''
      const itemNote = item.note || ''
      const itemVariationName = item.variationName || ''
      const quantity = parseInt(item.quantity) || 1

      // Combiner TOUTES les sources possibles de SKU/remarques
      const allText = `${itemName} ${itemNote} ${orderNote} ${itemVariationName} ${orderSource} ${orderReferenceId} ${orderTicketName}`.toLowerCase()

      // Trouver le SKU
      let sku: string | null = null
      let skuSource: string = 'none'

      // 1. SKU depuis le catalogue Square
      if (item.catalogObjectId) {
        sku = catalogIdToSku.get(item.catalogObjectId) || null
        if (sku) skuSource = 'catalog'
      }

      // 2. SKU extrait du nom (ex: "TDO4 Collier mix or argent")
      if (!sku && itemName && itemName !== 'Montant personnalisé') {
        const match = itemName.match(/^([A-Za-z0-9\-_]+)/i)
        if (match && match[1].length >= 2 && match[1].length <= 15) {
          sku = match[1]
          skuSource = 'itemName'
        }
      }

      // 3. SKU extrait de la note de l'article
      if (!sku && itemNote) {
        const cleanNote = itemNote.toLowerCase().trim()
        // Pattern: 2-4 lettres + 1-4 chiffres (ex: "ng56", "dm72", "cam70", "apf441")
        // Chercher PARTOUT dans la note, pas seulement au début
        const match = cleanNote.match(/\b([a-z]{2,4})(\d{1,4})\b/i)
        if (match) {
          sku = (match[1] + match[2]).toUpperCase()
          skuSource = 'itemNote'
        }
      }

      // 4. SKU extrait de la note de commande
      if (!sku && orderNote) {
        const cleanNote = orderNote.toLowerCase().replace(/square\s*regist(er)?\s*/gi, '').trim()
        const match = cleanNote.match(/\b([a-z]{2,4})\s*(\d{1,4})\b/i)
        if (match) {
          sku = (match[1] + match[2]).toUpperCase()
          skuSource = 'orderNote'
        }
      }

      // Log pour debug
      if (!sku) {
        console.log(`⚠️ Pas de SKU trouvé pour: "${itemName}" | note: "${itemNote}" | orderNote: "${orderNote}"`)
      }

      // Chercher le produit par SKU
      let produitDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null
      if (sku) {
        const skuNorm = sku.toLowerCase().replace(/\s+/g, '')
        produitDoc = produitsBySku.get(skuNorm) || null
      }

      // Créer la vente
      const venteData: any = {
        orderId: order.id,
        lineItemUid,
        dateVente: Timestamp.fromDate(orderDate),
        prixVenteReel: prix,
        quantite: quantity,
        nomSquare: itemName,
        noteArticle: itemNote || null,
        noteCommande: orderNote || null,
        skuSquare: sku,
        skuSource,
        source: item.catalogObjectId ? 'square' : 'montant_perso',
        createdAt: Timestamp.now(),
      }

      if (produitDoc) {
        // Vente attribuée
        const p = produitDoc.data()
        venteData.produitId = produitDoc.id
        venteData.nom = p.nom
        venteData.sku = p.sku
        venteData.chineur = p.chineur
        venteData.chineurUid = p.chineurUid
        venteData.trigramme = p.trigramme
        venteData.prixInitial = p.prix
        venteData.attribue = true

        // Mettre à jour le produit
        const newQty = Math.max(0, (p.quantite || 1) - quantity)
        const updateData: any = { quantite: newQty }
        if (newQty === 0) {
          updateData.vendu = true
          updateData.dateVente = Timestamp.fromDate(orderDate)
          updateData.prixVenteReel = prix
        }
        produitsToUpdate.push({ ref: produitDoc.ref, data: updateData })
        nbAttribuees++
      } else {
        // Vente non attribuée
        venteData.produitId = null
        venteData.nom = itemName || itemNote || orderNote || 'Vente inconnue'
        venteData.sku = sku
        venteData.chineurUid = null
        venteData.trigramme = null
        venteData.attribue = false
        nbNonAttribuees++
      }

      ventesToAdd.push(venteData)
      nbImported++
    }
  }

  // 6. Écrire en batch
  const BATCH_SIZE = 500

  for (let i = 0; i < ventesToAdd.length; i += BATCH_SIZE) {
    const batch = adminDb.batch()
    for (const vente of ventesToAdd.slice(i, i + BATCH_SIZE)) {
      batch.set(adminDb.collection('ventes').doc(), vente)
    }
    await batch.commit()
  }

  for (let i = 0; i < produitsToUpdate.length; i += BATCH_SIZE) {
    const batch = adminDb.batch()
    for (const { ref, data } of produitsToUpdate.slice(i, i + BATCH_SIZE)) {
      batch.update(ref, data)
    }
    await batch.commit()
  }

  console.log(`✅ ${nbImported} importées, ${nbAttribuees} attribuées, ${nbNonAttribuees} à attribuer, ${nbSkipped} doublons évités`)

  return {
    success: true,
    message: `${nbImported} ventes (${nbAttribuees} attribuées, ${nbNonAttribuees} à attribuer)`,
    nbImported,
    nbAttribuees,
    nbNonAttribuees,
    nbSkipped,
  }
}