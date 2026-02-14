// lib/syncSquareToFirestore.ts
import { Client, Environment } from 'square'
import { adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: Environment.Production,
})

const locationId = process.env.SQUARE_LOCATION_ID!

// Table de correspondance nom chineuse → trigrammes possibles
const chineuseToTrigrammes: Record<string, string[]> = {
  'aerea': ['AE'],
  'age': ['AGE'],
  'aime': ['AIM'],
  'alisa': ['ACAY'],
  'cayoo': ['ACAY'],
  'anashi': ['ANA', 'AN'],
  'archive': ['ARC'],
  'bonage': ['BON'],
  'brillante': ['BRI'],
  'brujas': ['BRU'],
  'cameleon': ['CAM'],
  'cent-neuf': ['CN'],
  'equine': ['EQU'],
  'cozines': ['COZ'],
  'coz': ['COZ'],
  'dark': ['DV'],
  'diabolo': ['DM'],
  'menthe': ['DM'],
  'frusques': ['FRU'],
  'ines': ['IP'],
  'pineau': ['IP'],
  'maison': ['MB'],
  'beguin': ['MB'],
  'maki': ['MAK'],
  'mission': ['MV', 'MIS'],
  'muse': ['MUS', 'MR'],
  'rebelle': ['MUS', 'MR'],
  'nan': ['NG'],
  'goldies': ['NG'],
  'nouvelle': ['NR'],
  'rive': ['NR'],
  'pardon': ['PP'],
  'personal': ['PS'],
  'seller': ['PS'],
  'porte': ['POR'],
  'prestanx': ['PRE'],
  'pristini': ['PRI'],
  'rashhiiid': ['RAS'],
  'sergio': ['ST'],
  'tacchineur': ['ST'],
  'soir': ['SOI'],
  'strass': ['STRC'],
  'chronique': ['STRC'],
  'tete': ['TDO'],
  'orange': ['TDO'],
  'dorange': ['TDO'],
  'parisian': ['PV', 'TPV'],
}

// Extraire les trigrammes possibles d'un nom
const extractTrigrammesFromName = (nom: string): string[] => {
  const nomLower = nom.toLowerCase()
  const trigrammes: string[] = []
  
  for (const [keyword, tris] of Object.entries(chineuseToTrigrammes)) {
    if (nomLower.includes(keyword)) {
      trigrammes.push(...tris)
    }
  }
  
  return [...new Set(trigrammes)]
}

// Extraire les mots significatifs d'un texte (pour comparaison)
const extractSignificantWords = (text: string): Set<string> => {
  const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'au', 'aux', 'avec', 'pour', 'par', 'sur', 'sous', 'dans', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'noir', 'blanc', 'bleu', 'rouge', 'vert', 'gris', 'beige', 'rose', 'marron', 'black', 'white', 'blue', 'red', 'green', 'grey', 'gray', 'brown', 'pink', 'taille', 'size', 'small', 'medium', 'large'])
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-zàâäéèêëïîôùûüç0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !stopWords.has(w))
  )
}

// Mots génériques à ne pas considérer comme "uniques"
const motsGeneriques = new Set(['veste', 'jupe', 'robe', 'pantalon', 'chemise', 'pull', 'manteau', 'blouson', 'jacket', 'coat', 'dress', 'shirt', 'pants', 'skirt', 'top', 'jean', 'jeans', 'blazer', 'cardigan', 'sweater', 'leather', 'cuir', 'vintage'])

// Vérifier si deux noms correspondent (mots significatifs en commun)
const hasSignificantWordsInCommon = (nom1: string, nom2: string): boolean => {
  const mots1 = extractSignificantWords(nom1)
  const mots2 = extractSignificantWords(nom2)
  
  let motsEnCommun = 0
  let motUniqueEnCommun = false
  
  for (const mot of mots1) {
    if (mots2.has(mot)) {
      motsEnCommun++
      if (!motsGeneriques.has(mot) && mot.length >= 5) {
        motUniqueEnCommun = true
      }
    }
  }
  
  // 2+ mots en commun OU 1 mot unique/rare en commun
  return motsEnCommun >= 2 || motUniqueEnCommun
}

/**
 * Sync TOUTES les ventes Square d'une période
 * Match par SKU uniquement
 * Déduplication intelligente par orderId+lineItemUid, SKU, et correspondance nom/trigramme
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
  const ventesExistantesParOrder = new Set<string>()
  const ventesSnap = await adminDb.collection('ventes').get()
  
  for (const doc of ventesSnap.docs) {
    const data = doc.data()
    
    // Clé 1: orderId + lineItemUid (pour ventes Square avec catalogObjectId)
    if (data.orderId && data.lineItemUid) {
      ventesExistantesParOrder.add(`order-${data.orderId}-${data.lineItemUid}`)
    }
  }
  console.log(`📋 ${ventesExistantesParOrder.size} ventes existantes (par orderId+lineItemUid)`)

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
      
      // Skip si déjà importé par orderId
      if (ventesExistantesParOrder.has(dedupeKeyOrder)) {
        nbSkipped++
        continue
      }
      
      const itemName = item.name || ''
      const itemNote = item.note || ''

      // Ajouter la clé pour éviter les doublons dans le même batch
      ventesExistantesParOrder.add(dedupeKeyOrder)

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

      // FALLBACK: Si pas trouvé, chercher d'autres SKUs dans le nom/note
      if (!produitDoc) {
        const sources = [itemName, itemNote, orderNote].filter(Boolean)
        const candidates: string[] = []

        for (const src of sources) {
          // Extraire la partie après " - " (ex: "375800Q - IP23_BA06" → "IP23_BA06")
          const afterDash = src.match(/\s[-–]\s(.+)/)?.[1]?.trim()
          if (afterDash) {
            const dashSku = afterDash.match(/^([A-Za-z0-9_\-]+)/)?.[1]
            if (dashSku && dashSku.length >= 3) candidates.push(dashSku)
          }
          // Extraire tous les patterns SKU: 2-4 lettres + chiffres (+ optionnel _suffix)
          const patterns = src.match(/\b[A-Za-z]{2,4}\d{1,4}(?:[_][A-Za-z0-9]+)*\b/gi) || []
          candidates.push(...patterns)
        }

        // Tester chaque candidat (en évitant celui déjà testé)
        const alreadyTried = sku?.toLowerCase().replace(/\s+/g, '') || ''
        for (const candidate of candidates) {
          const norm = candidate.toLowerCase().replace(/\s+/g, '')
          if (norm === alreadyTried) continue
          const found = produitsBySku.get(norm)
          if (found) {
            produitDoc = found
            sku = candidate.toUpperCase()
            skuSource = 'fallback_name'
            console.log(`🔗 Fallback match: "${itemName}" → SKU ${sku}`)
            break
          }
        }
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
          // Vérifier si la chineuse est en petite série
          const tri = (p.sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase()
          let isSmallBatch = false
          if (tri) {
            const chineuseSnap = await adminDb.collection('chineuse')
              .where('trigramme', '==', tri)
              .limit(1)
              .get()
            if (!chineuseSnap.empty) {
              isSmallBatch = chineuseSnap.docs[0].data().stockType === 'smallBatch'
            }
          }

          if (isSmallBatch) {
            updateData.statut = 'outOfStock'
            updateData.dateRupture = Timestamp.fromDate(orderDate)
            if (prix) updateData.prixVenteReel = prix
          } else {
            updateData.vendu = true
            updateData.dateVente = Timestamp.fromDate(orderDate)
            if (prix) updateData.prixVenteReel = prix
          }
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