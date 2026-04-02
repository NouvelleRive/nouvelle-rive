// src/app/api/webhooks/square-pos/route.ts
// Webhook pour les ventes en boutique (POS Square)
// Met à jour Firebase automatiquement quand une vente est faite sur la caisse

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'
import { removeFromAllChannels } from '@/lib/syncRemoveFromAllChannels'

// Initialiser Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const adminDb = getFirestore()
const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY_POS

// Initialiser Square Client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: process.env.SQUARE_ENV === 'production' 
    ? Environment.Production 
    : Environment.Sandbox
})

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const headersList = await headers()
    
    // Vérifier la signature Square (sécurité)
    const signature = headersList.get('x-square-hmacsha256-signature')
    
    if (webhookSignatureKey && signature) {
      const notificationUrl = 'https://www.nouvellerive.eu/api/webhooks/square-pos'
      const hash = crypto
        .createHmac('sha256', webhookSignatureKey)
        .update(notificationUrl + body)
        .digest('base64')
      
      if (hash !== signature) {
        console.error('❌ [POS] Signature webhook invalide')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(body)
    
    console.log('🔔 [POS] Webhook Square reçu:', event.type)

    // On traite les commandes complétées (ventes en boutique)
    if (event.type !== 'order.updated' && event.type !== 'order.created') {
      return NextResponse.json({ received: true })
    }

    const orderId = event.data?.object?.order_id || event.data?.object?.order?.id
    if (!orderId) {
      console.log('⏭️ [POS] Pas d\'orderId')
      return NextResponse.json({ received: true })
    }

    const { result: orderResult } = await squareClient.ordersApi.retrieveOrder(orderId)
    const order = orderResult.order

    if (!order) {
      console.log('⏭️ [POS] Ordre non trouvé:', orderId)
      return NextResponse.json({ received: true })
    }

    if (order.state !== 'COMPLETED') {
      console.log('⏭️ [POS] Commande non complétée, état:', order.state)
      return NextResponse.json({ received: true })
    }

    if (order.metadata?.productId) {
      console.log('⏭️ [POS] Vente en ligne détectée, ignorée')
      return NextResponse.json({ received: true })
    }

    const lineItems = order.lineItems || []
    
    console.log('🏪 [POS] Vente en boutique détectée:', orderId, '- Articles:', lineItems.length)

    let nbProduitsTraites = 0

    for (const item of lineItems) {
      const catalogObjectId = item.catalogObjectId
      const quantiteVendue = parseInt(item.quantity) || 1
      const itemName = item.name || 'Produit inconnu'
      
      if (!catalogObjectId) {
        console.log('📝 [POS] Article sans catalogObjectId (montant perso):', itemName)
        
        const prixVenteReel = item.totalMoney?.amount 
          ? Number(item.totalMoney.amount) / 100 
          : null

        for (let i = 0; i < quantiteVendue; i++) {
          await adminDb.collection('ventes').add({
            produitId: null,
            nom: itemName,
            sku: null,
            trigramme: null,
            chineur: null,
            chineurUid: null,
            prixInitial: null,
            prixVenteReel: prixVenteReel ? prixVenteReel / quantiteVendue : null,
            dateVente: Timestamp.now(),
            orderId: orderId,
            lineItemUid: item.uid || null,
            source: 'boutique',
            attribue: false,
            createdAt: Timestamp.now(),
          })
        }
        console.log(`✅ [POS] ${quantiteVendue} vente(s) montant perso enregistrée(s)`)
        nbProduitsTraites++
        continue
      }

      console.log(`📦 [POS] Traitement: ${itemName} (x${quantiteVendue}) - ID: ${catalogObjectId}`)

      try {
        // Récupérer l'item parent depuis Square pour avoir l'itemId
        const { result } = await squareClient.catalogApi.retrieveCatalogObject(catalogObjectId, true)
        const variationObject = result.object
        const parentItemId = variationObject?.itemVariationData?.itemId

        // Chercher le produit dans Firebase
        let produitSnap = await adminDb.collection('produits')
          .where('variationId', '==', catalogObjectId)
          .limit(1)
          .get()

        if (produitSnap.empty) {
          produitSnap = await adminDb.collection('produits')
            .where('catalogObjectId', '==', catalogObjectId)
            .limit(1)
            .get()
        }

        if (produitSnap.empty && parentItemId) {
          produitSnap = await adminDb.collection('produits')
            .where('itemId', '==', parentItemId)
            .limit(1)
            .get()
        }

        if (produitSnap.empty && parentItemId) {
          produitSnap = await adminDb.collection('produits')
            .where('catalogObjectId', '==', parentItemId)
            .limit(1)
            .get()
        }

        if (produitSnap.empty) {
          console.warn(`⚠️ [POS] Produit non trouvé dans Firebase pour: ${itemName} (${catalogObjectId})`)
          continue
        }

        const produitDoc = produitSnap.docs[0]
        const produitData = produitDoc.data()
        const produitId = produitDoc.id
        const quantiteActuelle = produitData.quantite || 1
        const nouvelleQuantite = Math.max(0, quantiteActuelle - quantiteVendue)

        console.log(`📝 [POS] Mise à jour produit: ${produitData.nom || itemName}`)
        console.log(`   Quantité: ${quantiteActuelle} → ${nouvelleQuantite}`)

        // Calculer le prix de vente réel
        const prixVenteReel = item.totalMoney?.amount 
          ? Number(item.totalMoney.amount) / 100 
          : null

        // Préparer les données de mise à jour
        const updateData: any = {
          quantite: nouvelleQuantite,
          updatedAt: Timestamp.now()
        }

        if (nouvelleQuantite === 0) {
          // Vérifier si la chineuse est en petite série
          const tri = (produitData.sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase()
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
            updateData.dateRupture = Timestamp.now()
            updateData.squareOrderId = orderId
            if (prixVenteReel) updateData.prixVenteReel = prixVenteReel
            // PAS de vendu = true → le produit reste dans l'admin
          } else {
            updateData.vendu = true
            updateData.dateVente = Timestamp.now()
            updateData.squareOrderId = orderId
            if (prixVenteReel) updateData.prixVenteReel = prixVenteReel
          }
        }

        // Mettre à jour le produit dans Firebase
        await produitDoc.ref.update(updateData)
        console.log(`✅ [POS] Produit mis à jour: ${produitId}`)

        // Retirer d'eBay si stock à 0
        if (nouvelleQuantite === 0 && (produitData.ebayListingId || produitData.ebayOfferId)) {
          try {
            console.log('🇺🇸 Retrait du produit d\'eBay...')
            await removeFromAllChannels(
              {
                id: produitId,
                sku: produitData.sku,
                ebayOfferId: produitData.ebayOfferId,
                ebayListingId: produitData.ebayListingId,
              },
              'site'
            )
            console.log('✅ Produit retiré d\'eBay')
          } catch (ebayError: any) {
            console.error('⚠️ Erreur retrait eBay (non bloquant):', ebayError?.message)
          }
        }

        // Créer une entrée dans la collection "ventes" pour le suivi
        for (let i = 0; i < quantiteVendue; i++) {
          await adminDb.collection('ventes').add({
            produitId: produitId,
            nom: produitData.nom || itemName,
            sku: produitData.sku || null,
            categorie: produitData.categorie || null,
            marque: produitData.marque || null,
            chineur: produitData.chineur || null,
            chineurUid: produitData.chineurUid || null,
            categorieRapport: produitData.categorieRapport || null,
            trigramme: produitData.trigramme || null,
            prixInitial: produitData.prix || null,
            prixVenteReel: prixVenteReel ? prixVenteReel / quantiteVendue : null,
            dateVente: Timestamp.now(),
            orderId: orderId,
            source: 'boutique',
            createdAt: Timestamp.now(),
          })
        }
        console.log(`✅ [POS] ${quantiteVendue} vente(s) enregistrée(s) dans collection ventes`)

        nbProduitsTraites++

      } catch (error: any) {
        console.error(`❌ [POS] Erreur traitement ${itemName}:`, error?.message)
      }
    }

    console.log(`🎉 [POS] Traitement terminé: ${nbProduitsTraites} produit(s) mis à jour`)

    return NextResponse.json({ 
      received: true, 
      processed: nbProduitsTraites 
    })

  } catch (error) {
    console.error('❌ [POS] Erreur webhook:', error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}