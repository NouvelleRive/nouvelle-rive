  import { Client, Environment } from 'square'
  import {
    collection,
    getDocs,
    query,
    where,
    updateDoc,
    Timestamp,
    doc,
    getDoc,
  } from 'firebase/firestore'
  import { db } from '@/lib/firebaseConfig'

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

    const chineuseRef = doc(db, 'chineuse', uid)
    const chineuseSnap = await getDoc(chineuseRef)

    if (!chineuseSnap.exists()) {
      console.error(`❌ Chineuse ${uid} non trouvée dans Firestore`)
      throw new Error(`Chineuse ${uid} non trouvée dans Firestore`)
    }

    const chineuseData = chineuseSnap.data()

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
            console.log(`📌 Produit : ${item.name} — Catégorie ID Square : ${categoryId}`)

            if (!categoryId || !categoriesIds.includes(categoryId)) {
              console.log(`⏭️ Ignoré : catégorie non liée à ${chineurNom}`)
              continue
            }

            // 1️⃣ Recherche sur variationId
            let snap = await getDocs(query(
              collection(db, 'produits'),
              where('catalogObjectId', '==', variationId),
              where('vendu', '!=', true)
            ))

            // 2️⃣ Si rien trouvé, fallback sur parentId
            if (snap.empty && parentId) {
              console.log(`🔁 Aucun match avec variationId ${variationId}, tentative avec parentId ${parentId}`)
              snap = await getDocs(query(
                collection(db, 'produits'),
                where('catalogObjectId', '==', parentId),
                where('vendu', '!=', true)
              ))
            }

            if (snap.empty) {
              console.warn(`❓ Aucun produit Firestore trouvé non vendu pour variationId : ${variationId} ou parentId : ${parentId}`)
              continue
            }

            for (const docSnap of snap.docs) {
            const prixReelCents = item.totalMoney?.amount ?? null
            let prixReel = null

            if (prixReelCents !== null) {
              prixReel = typeof prixReelCents === 'bigint'
                ? Number(prixReelCents) / 100
                : prixReelCents / 100
}

              

              console.log(`📝 Mise à jour du produit Firestore : ${docSnap.id}`, {
                vendu: true,
                dateVente: order.closedAt,
                prixVenteReel: prixReel,
              })

              await updateDoc(docSnap.ref, {
                vendu: true,
                dateVente: Timestamp.fromDate(new Date(order.closedAt)),
                prixVenteReel: prixReel,
              })

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
