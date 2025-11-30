import { Client, Environment } from 'square'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'

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
  console.log('🔄 Début synchronisation ventes Square pour', chineurNom)

  const adminDb = getFirestore()
  
  const chineuseRef = adminDb.collection('chineuse').doc(uid)
  const chineuseSnap = await chineuseRef.get()

  if (!chineuseSnap.exists) {
    console.error(`❌ Chineuse ${uid} non trouvée dans Firestore`)
    throw new Error(`Chineuse ${uid} non trouvée dans Firestore`)
  }

  const chineuseData = chineuseSnap.data()!

  const categoriesFirestore = Array.isArray(chineuseData?.Catégorie)
    ? chineuseData.Catégorie
    : []
  const categoriesIds = categoriesFirestore
    .map((cat: any) => cat?.idsquare)
    .filter((id: any) => typeof id === 'string' && id.length > 0)
  
  // Récupérer aussi les labels des catégories pour matching par label
  const categoriesLabels = categoriesFirestore
    .map((cat: any) => cat?.label)
    .filter((label: any) => typeof label === 'string' && label.length > 0)

  console.log('✅ Catégories autorisées (idsquare):', JSON.stringify(categoriesIds))
  console.log('✅ Catégories autorisées (labels):', JSON.stringify(categoriesLabels))

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
    console.log('📅 Filtres de date:', JSON.stringify(filterSquare.dateTimeFilter))
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
    console.log(`📦 Commandes récupérées: ${orders.length}`)

    let nbSync = 0
    let nbNoCatalogId = 0
    let nbCategoryMismatch = 0
    let nbNotFoundFirestore = 0

    for (const order of orders) {
      const lineItems = order.lineItems || []

      for (const item of lineItems) {
        const variationId = item.catalogObjectId
        const itemName = item.name || 'Sans nom'
        const quantityVendue = parseInt(item.quantity) || 1
        
        if (!variationId) {
          // 🆕 LOG le nom pour debug
          console.log(`⚠️ Sans catalogObjectId: "${itemName}"`)
          
          // 🆕 FALLBACK PAR SKU - Patterns améliorés
          // Patterns possibles: "PV31 - Nom", "5 - Nom", "ABC123 - Nom", "11 - Nom"
          const skuPatterns = [
            /^([A-Z]{2,3}\d+)\s*-/i,        // PV31 - , ABC123 -
            /^(\d+)\s*-/,                    // 5 - , 11 - , 42 -
            /^([A-Z]{2,3}\d+)\s+/i,          // PV31 Nom (sans tiret)
          ]
          
          let sku: string | null = null
          for (const pattern of skuPatterns) {
            const match = itemName.match(pattern)
            if (match) {
              sku = match[1].toUpperCase()
              break
            }
          }
          
          if (sku) {
            console.log(`🔍 Tentative par SKU: "${sku}" (depuis "${itemName}")`)
            
            // Chercher le produit par SKU
            const snapBySku = await adminDb.collection('produits')
              .where('sku', '==', sku)
              .get()
            
            if (!snapBySku.empty) {
              const docSnap = snapBySku.docs[0]
              const produitData = docSnap.data()
              
              console.log(`✅ Produit trouvé par SKU: ${sku}, catégorie: ${produitData.categorie}`)
              
              // Vérifier si la catégorie du produit appartient à cette chineuse
              const produitCategorie = typeof produitData.categorie === 'object' 
                ? produitData.categorie?.label 
                : produitData.categorie
              
              const chineuseHasCategory = categoriesLabels.some((label: string) => 
                label.toLowerCase() === (produitCategorie || '').toLowerCase()
              )
              
              if (!chineuseHasCategory) {
                console.log(`⏭️ SKU ${sku}: catégorie "${produitCategorie}" pas dans [${categoriesLabels.join(', ')}]`)
                nbCategoryMismatch++
                continue
              }
              
              // Vérifier doublon
              if (produitData.lastOrderId === order.id) {
                console.log(`⏭️ Déjà traité: ${docSnap.id}`)
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

              // Créer ventes
              for (let i = 0; i < quantityVendue; i++) {
                await adminDb.collection('ventes').add({
                  produitId: docSnap.id,
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

              // Update produit
              const updateData: any = {
                quantite: nouvQuantite,
                lastOrderId: order.id,
              }
              if (nouvQuantite === 0) {
                updateData.vendu = true
                updateData.dateVente = Timestamp.fromDate(new Date(order.closedAt!))
                updateData.prixVenteReel = prixReel
              }

              await docSnap.ref.update(updateData)
              console.log(`✅ SYNC PAR SKU: ${sku} → ${produitData.nom}`)
              nbSync++
              continue
            } else {
              console.log(`❓ SKU "${sku}" non trouvé dans Firestore`)
              nbNotFoundFirestore++
            }
          }
          
          nbNoCatalogId++
          continue
        }

        // Avec catalogObjectId - logique existante
        try {
          const variationRes = await client.catalogApi.retrieveCatalogObject(variationId, true)
          const variationObject = variationRes.result.catalogObject
          const itemObject = variationRes.result.relatedObjects?.find(obj => obj.type === 'ITEM')
          const parentId = variationObject?.itemVariationData?.itemId

          if (!itemObject) {
            console.warn(`⚠️ Pas d'item parent pour variation ${variationId}`)
            continue
          }

          const categoryId = itemObject.itemData?.categoryId

          if (!categoryId || !categoriesIds.includes(categoryId)) {
            nbCategoryMismatch++
            continue
          }

          // Recherche produit Firestore
          let snap = await adminDb.collection('produits')
            .where('catalogObjectId', '==', variationId)
            .get()

          if (snap.empty) {
            snap = await adminDb.collection('produits')
              .where('variationId', '==', variationId)
              .get()
          }

          if (snap.empty && parentId) {
            snap = await adminDb.collection('produits')
              .where('catalogObjectId', '==', parentId)
              .get()
          }

          if (snap.empty && parentId) {
            snap = await adminDb.collection('produits')
              .where('itemId', '==', parentId)
              .get()
          }

          if (snap.empty) {
            snap = await adminDb.collection('produits')
              .where('itemId', '==', variationId)
              .get()
          }

          if (snap.empty) {
            console.warn(`❓ Pas de produit Firestore pour ${variationId}/${parentId}`)
            nbNotFoundFirestore++
            continue
          }

          for (const docSnap of snap.docs) {
            const produitData = docSnap.data()
            
            if (produitData.lastOrderId === order.id) {
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

            for (let i = 0; i < quantityVendue; i++) {
              await adminDb.collection('ventes').add({
                produitId: docSnap.id,
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

            const updateData: any = {
              quantite: nouvQuantite,
              lastOrderId: order.id,
            }
            if (nouvQuantite === 0) {
              updateData.vendu = true
              updateData.dateVente = Timestamp.fromDate(new Date(order.closedAt!))
              updateData.prixVenteReel = prixReel
            }

            await docSnap.ref.update(updateData)
            console.log(`✅ SYNC: ${docSnap.id} (${itemName})`)
            nbSync++
          }
        } catch (catError: any) {
          console.warn(`⚠️ Erreur catalog ${variationId}:`, catError?.message?.substring(0, 100))
        }
      }
    }

    const summary = `${nbSync} ventes sync, ${nbNoCatalogId} sans catalogId, ${nbCategoryMismatch} catégorie non liée, ${nbNotFoundFirestore} non trouvés`
    console.log(`🎉 Terminé: ${summary}`)
    return { message: summary }
  } catch (error) {
    console.error('❌ Erreur:', error)
    throw error
  }
}