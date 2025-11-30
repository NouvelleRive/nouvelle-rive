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

  console.log('✅ Champ catégories trouvé avec la clé : "Catégorie"')
  console.log('📂 Catégories autorisées (idsquare) pour cette chineuse :', categoriesIds)

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

    for (const order of orders) {
      const lineItems = order.lineItems || []

      for (const item of lineItems) {
        const variationId = item.catalogObjectId
        const quantityVendue = parseInt(item.quantity) || 1
        
        if (!variationId) {
          console.warn('⚠️ Ligne sans catalogObjectId, ignorée')
          continue
        }

        try {
          const variationRes = await client.catalogApi.retrieveCatalogObject(variationId, true)
          const variationObject = variationRes.result.catalogObject
          const itemObject = variationRes.result.relatedObjects?.find(obj => obj.type === 'ITEM')
          const parentId = variationObject?.itemVariationData?.itemId

          if (!itemObject) {
            console.warn(`⚠️ Aucun item parent trouvé pour la variation ${variationId}`)
            continue
          }

          const categoryId = itemObject.itemData?.categoryId
          console.log(`📌 Produit : ${item.name} — Catégorie ID Square : ${categoryId} — Quantité vendue : ${quantityVendue}`)

          if (!categoryId || !categoriesIds.includes(categoryId)) {
            console.log(`⏭️ Ignoré : catégorie non liée à ${chineurNom}`)
            continue
          }

          // 🔍 RECHERCHE AMÉLIORÉE - Multiple stratégies
          let snap = await adminDb.collection('produits')
            .where('catalogObjectId', '==', variationId)
            .get()
          console.log(`🔍 Recherche par catalogObjectId=${variationId}: ${snap.size} résultat(s)`)

          // 2️⃣ Fallback sur variationId field
          if (snap.empty) {
            snap = await adminDb.collection('produits')
              .where('variationId', '==', variationId)
              .get()
            console.log(`🔍 Recherche par variationId=${variationId}: ${snap.size} résultat(s)`)
          }

          // 3️⃣ Fallback sur parentId (itemId de Square)
          if (snap.empty && parentId) {
            snap = await adminDb.collection('produits')
              .where('catalogObjectId', '==', parentId)
              .get()
            console.log(`🔍 Recherche par catalogObjectId=${parentId}: ${snap.size} résultat(s)`)
          }

          // 4️⃣ Fallback sur itemId field
          if (snap.empty && parentId) {
            snap = await adminDb.collection('produits')
              .where('itemId', '==', parentId)
              .get()
            console.log(`🔍 Recherche par itemId=${parentId}: ${snap.size} résultat(s)`)
          }

          // 5️⃣ NOUVEAU: Recherche par itemId avec variationId
          if (snap.empty) {
            snap = await adminDb.collection('produits')
              .where('itemId', '==', variationId)
              .get()
            console.log(`🔍 Recherche par itemId=${variationId}: ${snap.size} résultat(s)`)
          }

          if (snap.empty) {
            console.warn(`❓ Aucun produit Firestore trouvé pour variationId: ${variationId} ou parentId: ${parentId}`)
            continue
          }

          // ✅ LOGIQUE DE DÉCRÉMENTATION
          for (const docSnap of snap.docs) {
            const produitData = docSnap.data()
            
            // Vérifier si ce produit n'est pas déjà marqué vendu pour cette commande
            if (produitData.lastOrderId === order.id) {
              console.log(`⏭️ Produit ${docSnap.id} déjà traité pour commande ${order.id}`)
              continue
            }
            
            const quantiteActuelle = produitData.quantite || 1
            const nouvQuantite = Math.max(0, quantiteActuelle - quantityVendue)

            const prixReelCents = item.totalMoney?.amount ?? null
            let prixReel = null

            if (prixReelCents !== null) {
              prixReel = typeof prixReelCents === 'bigint'
                ? Number(prixReelCents) / 100
                : prixReelCents / 100
            }

            // Créer une ligne dans la collection "ventes" pour chaque unité vendue
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

            // Mise à jour du produit
            const updateData: any = {
              quantite: nouvQuantite,
              lastOrderId: order.id, // Pour éviter les doublons
            }

            // Si quantité = 0, marquer comme vendu
            if (nouvQuantite === 0) {
              updateData.vendu = true
              updateData.dateVente = Timestamp.fromDate(new Date(order.closedAt!))
              updateData.prixVenteReel = prixReel
            }

            console.log(`📝 Mise à jour du produit Firestore : ${docSnap.id}`, {
              quantiteAvant: quantiteActuelle,
              quantiteApres: nouvQuantite,
              quantityVendue,
              vendu: nouvQuantite === 0,
            })

            await docSnap.ref.update(updateData)

            console.log(`✅ Produit mis à jour dans Firestore : ${docSnap.id}`)
            nbSync++
          }
        } catch (catError) {
          console.warn(`⚠️ Erreur de récupération catalog pour ${variationId} :`, catError)
        }
      }
    }

    console.log(`🎉 Synchronisation terminée — ${nbSync} ventes synchronisées.`)
    return { message: `${nbSync} ventes synchronisées.` }
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation :', error)
    throw error
  }
}