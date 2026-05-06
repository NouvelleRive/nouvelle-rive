// src/app/api/webhooks/square/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { Resend } from 'resend'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'
import { removeFromAllChannels } from '@/lib/syncRemoveFromAllChannels'
import { sendPushToOwner } from '@/lib/webpush'

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
const resend = new Resend(process.env.RESEND_API_KEY)
const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY_SITE

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: process.env.SQUARE_ENV === 'production'
    ? Environment.Production
    : Environment.Sandbox
})

function genererNumeroGroupe(email: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
  const emailHash = email.split('@')[0].substring(0, 4).toUpperCase()
  return `GRP-${dateStr}-${emailHash}`
}

// Traite UN produit du panier : maj produit + création commande + création vente + retrait des canaux
async function traiterProduit(opts: {
  productId: string
  paymentId: string
  orderId: string
  saleTimestamp: Timestamp
  clientInfo: { prenom: string; nom: string; email: string; telephone?: string }
  modeLivraison: string | null
  adresse: any
  numeroGroupe: string
  lineItem: any
  lineItemPrice: number
  productNameFallback: string
}) {
  const { productId, paymentId, orderId, saleTimestamp, clientInfo, modeLivraison, adresse, numeroGroupe, lineItem, lineItemPrice, productNameFallback } = opts

  const produitRef = adminDb.collection('produits').doc(productId)
  const produitSnap = await produitRef.get()

  if (!produitSnap.exists) {
    console.error('❌ Produit non trouvé:', productId)
    return null
  }

  const produitData = produitSnap.data()!
  const quantiteActuelle = produitData.quantite || 1
  const nouvelleQuantite = Math.max(0, quantiteActuelle - 1)

  const tri = (produitData.sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase()
  let isSmallBatch = false
  if (tri && nouvelleQuantite === 0) {
    const chineuseSnap = await adminDb.collection('chineuse')
      .where('trigramme', '==', tri)
      .limit(1)
      .get()
    if (!chineuseSnap.empty) {
      isSmallBatch = chineuseSnap.docs[0].data().stockType === 'smallBatch'
    }
  }

  const updateData: any = { quantite: nouvelleQuantite }
  if (nouvelleQuantite === 0) {
    if (isSmallBatch) {
      updateData.statut = 'outOfStock'
      updateData.dateRupture = saleTimestamp
      updateData.squareOrderId = orderId
    } else {
      updateData.vendu = true
      updateData.dateVente = saleTimestamp
      updateData.squareOrderId = orderId
    }
  }
  await produitRef.update(updateData)
  console.log('✅ Produit mis à jour:', productId, '- Nouvelle quantité:', nouvelleQuantite)

  // Suppression Square (pièce unique épuisée)
  if (nouvelleQuantite === 0 && !isSmallBatch && (produitData.catalogObjectId || produitData.variationId || produitData.itemId)) {
    try {
      const variationId = produitData.variationId || produitData.catalogObjectId
      if (variationId) {
        try {
          await squareClient.catalogApi.deleteCatalogObject(variationId)
          console.log('✅ Variation supprimée de Square:', variationId)
        } catch (delError: any) {
          console.warn('⚠️ Suppression variation échouée:', delError?.message)
        }
      }
      const itemId = produitData.itemId
      if (itemId) {
        try {
          await squareClient.catalogApi.deleteCatalogObject(itemId)
          console.log('✅ Item supprimé de Square:', itemId)
        } catch (delItemError: any) {
          console.warn('⚠️ Suppression item échouée, tentative d\'archivage...', delItemError?.message)
          try {
            const { result } = await squareClient.catalogApi.retrieveCatalogObject(itemId)
            const item = result.object
            if (item && item.itemData) {
              await squareClient.catalogApi.upsertCatalogObject({
                idempotencyKey: `archive-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                object: {
                  id: itemId,
                  type: 'ITEM',
                  version: item.version,
                  presentAtAllLocations: false,
                  itemData: {
                    name: item.itemData.name || 'Archived',
                    description: item.itemData.description,
                    categoryId: item.itemData.categoryId,
                    variations: item.itemData.variations,
                    productType: item.itemData.productType,
                    isArchived: true,
                  }
                }
              })
              console.log('✅ Produit archivé dans Square:', itemId)
            }
          } catch (archiveError: any) {
            console.error('❌ Archivage Square échoué:', archiveError?.message)
          }
        }
      }
    } catch (squareError: any) {
      console.error('❌ Erreur globale suppression Square:', squareError?.message)
    }
  }

  // eBay
  if (nouvelleQuantite === 0 && (produitData.ebayListingId || produitData.ebayOfferId)) {
    try {
      await removeFromAllChannels(
        {
          id: productId,
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

  // Création de la commande
  const nouvelleCommande = {
    orderId,
    productId,
    productName: produitData.nom || productNameFallback,
    productSku: produitData.sku || null,
    productMarque: produitData.marque || null,
    productImage: produitData.images?.[0] || produitData.imageUrl || produitData.photos?.face || produitData.imageUrls?.[0] || null,
    prix: produitData.prix || lineItemPrice,

    client: clientInfo,
    modeLivraison,
    adresse: modeLivraison === 'livraison' ? adresse : null,

    statut: 'en_attente',

    dateCommande: Timestamp.now(),
    datePaiement: Timestamp.now(),

    numeroGroupe,
    regroupeAvec: [] as string[],

    createdAt: Timestamp.now(),
  }
  const commandeRef = await adminDb.collection('commandes').add(nouvelleCommande)
  const commandeId = commandeRef.id
  console.log('✅ Commande créée:', commandeId)

  // Création de la vente
  const trigramme = (produitData.sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || null
  let chineurEmail = produitData.chineur || null
  let chineurUid = produitData.chineurUid || null

  if (!chineurEmail && trigramme) {
    const chineuseSnap = await adminDb.collection('chineuse')
      .where('trigramme', '==', trigramme)
      .limit(1)
      .get()
    if (!chineuseSnap.empty) {
      chineurEmail = chineuseSnap.docs[0].data().email || null
      chineurUid = chineuseSnap.docs[0].id
    }
  }

  const venteData = {
    paymentId,
    orderId,
    lineItemUid: lineItem?.uid || null,
    dateVente: saleTimestamp,
    prixVenteReel: produitData.prix || lineItemPrice,
    quantite: 1,
    nomSquare: lineItem?.name || productNameFallback,
    produitId: productId,
    nom: produitData.nom || lineItem?.name || productNameFallback,
    sku: produitData.sku || null,
    skuSquare: produitData.sku || null,
    chineur: chineurEmail,
    chineurUid,
    trigramme,
    prixInitial: produitData.prix || null,
    attribue: true,
    source: 'square',
    skuSource: 'webhook',
    createdAt: saleTimestamp,
  }
  const venteDocId = `${orderId}_${lineItem?.uid || productId}`
  await adminDb.collection('ventes').doc(venteDocId).set(venteData, { merge: true })
  console.log('✅ Vente créée:', produitData.sku, `[${venteDocId}]`)

  // Push notif
  try {
    const titre = `🛒 Vente en ligne : ${produitData.sku || produitData.nom || lineItem?.name}`
    const corps = `${produitData.prix || lineItemPrice}€ — ${clientInfo.prenom} ${clientInfo.nom}`
    await sendPushToOwner('boutique', { title: titre, body: corps, url: '/admin/commandes', tag: venteDocId })
    if (chineurUid) {
      await sendPushToOwner(chineurUid, { title: '🎉 Vente en ligne !', body: `${produitData.sku || produitData.nom} vendu ${produitData.prix || lineItemPrice}€`, url: '/chineuse/mes-ventes', tag: venteDocId })
    }
  } catch (e) { console.warn('Push notif failed:', e) }

  return {
    commandeId,
    produitData,
    nouvelleQuantite,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const headersList = await headers()

    const signature = headersList.get('x-square-hmacsha256-signature')
    if (webhookSignatureKey && signature) {
      const notificationUrl = 'https://www.nouvellerive.eu/api/webhooks/square'
      const hash = crypto
        .createHmac('sha256', webhookSignatureKey)
        .update(notificationUrl + body)
        .digest('base64')
      if (hash !== signature) {
        console.error('❌ Signature webhook invalide')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(body)
    console.log('🔔 Webhook Square reçu:', event.type)

    // payment.updated : on N'ÉCRIT JAMAIS DE VENTE depuis cet event (la vente
    // est créée par payment.created). On loggue juste si Square signale un
    // problème (paiement annulé ou échoué) pour que ça remonte dans les logs.
    if (event.type === 'payment.updated') {
      const p = event.data?.object?.payment
      if (p && (p.status === 'CANCELED' || p.status === 'FAILED')) {
        console.warn('⚠️ payment.updated avec statut problématique:', p.id, '—', p.status)
      }
      return NextResponse.json({ received: true })
    }

    if (event.type !== 'payment.created') {
      return NextResponse.json({ received: true })
    }

    const payment = event.data?.object?.payment
    if (!payment) {
      return NextResponse.json({ received: true })
    }

    const paymentId = payment.id
    const orderId = payment.order_id
    if (!orderId) {
      console.log('⚠️ Pas d\'order_id dans le paiement')
      return NextResponse.json({ received: true })
    }
    console.log('✅ payment.created reçu pour order:', orderId, '— status:', payment.status)

    const { result } = await squareClient.ordersApi.retrieveOrder(orderId)
    const order = result.order

    const saleDate = order?.closedAt
      ? new Date(order.closedAt)
      : order?.createdAt
        ? new Date(order.createdAt)
        : new Date()
    const saleTimestamp = Timestamp.fromDate(saleDate)

    const metadata = order?.metadata || {}

    // Multi-articles (panier) ou legacy mono-produit ?
    const productIdsCsv: string = metadata.productIds || metadata.productId || ''
    const productIds = productIdsCsv.split(',').map(s => s.trim()).filter(Boolean)

    // Vente caisse (pas de productId du tout) → garder le comportement existant
    if (productIds.length === 0) {
      const lineItems = order?.lineItems || []
      console.log('🏪 Vente caisse détectée (pas de productId)')

      for (let idx = 0; idx < lineItems.length; idx++) {
        const item = lineItems[idx]
        const itemName = item.name || ''
        const prix = item.totalMoney?.amount ? Number(item.totalMoney.amount) / 100 : 0
        const venteDocId = `${orderId}_${item.uid || `i${idx}`}`

        let sku: string | null = null
        const skuMatch = itemName.match(/^([A-Za-z]{2,4}\d{1,4}(?:[_][A-Za-z0-9]+)*)/i)
        if (skuMatch) sku = skuMatch[1].toUpperCase()

        if (!sku && item.catalogObjectId) {
          try {
            const { result } = await squareClient.catalogApi.retrieveCatalogObject(item.catalogObjectId)
            const obj = result.object
            if (obj?.type === 'ITEM_VARIATION' && obj.itemVariationData?.sku) {
              sku = obj.itemVariationData.sku
            }
          } catch (e) {
            console.warn('⚠️ Erreur catalogue:', e)
          }
        }

        let produitDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null
        let produitData: any = null
        if (sku) {
          const skuNorm = sku.toLowerCase().replace(/\s+/g, '')
          const snap = await adminDb.collection('produits')
            .where('sku', '==', sku)
            .limit(1)
            .get()
          if (snap.empty) {
            const snap2 = await adminDb.collection('produits')
              .where('sku', '==', skuNorm.toUpperCase())
              .limit(1)
              .get()
            if (!snap2.empty) produitDoc = snap2.docs[0] as any
          } else {
            produitDoc = snap.docs[0] as any
          }
          if (produitDoc) produitData = produitDoc.data()
        }

        const trigramme = sku?.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || null
        let chineurEmail = produitData?.chineur || null
        let chineurUid = produitData?.chineurUid || null

        if (!chineurEmail && trigramme) {
          const chineuseSnap = await adminDb.collection('chineuse')
            .where('trigramme', '==', trigramme)
            .limit(1)
            .get()
          if (!chineuseSnap.empty) {
            chineurEmail = chineuseSnap.docs[0].data().email || null
            chineurUid = chineuseSnap.docs[0].id
          }
        }

        const venteData = {
          paymentId,
          orderId,
          lineItemUid: item.uid || null,
          dateVente: saleTimestamp,
          prixVenteReel: prix,
          quantite: parseInt(item.quantity) || 1,
          nomSquare: itemName,
          produitId: produitDoc?.id || null,
          nom: produitData?.nom || itemName,
          sku: produitData?.sku || sku,
          skuSquare: sku,
          chineur: chineurEmail,
          chineurUid,
          trigramme,
          prixInitial: produitData?.prix || null,
          attribue: !!produitDoc,
          source: 'square',
          skuSource: 'webhook_caisse',
          createdAt: saleTimestamp,
        }

        await adminDb.collection('ventes').doc(venteDocId).set(venteData, { merge: true })
        console.log(`✅ Vente caisse créée: ${sku || itemName} (${prix}€) [${venteDocId}]`)

        try {
          const titre = `Vente boutique : ${sku || itemName}`
          const corps = `${prix}€${produitData?.nom ? ` — ${produitData.nom}` : ''}`
          await sendPushToOwner('boutique', { title: titre, body: corps, url: '/admin/nos-ventes', tag: venteDocId })
          if (chineurUid) {
            await sendPushToOwner(chineurUid, { title: '🎉 Vente !', body: `${sku || itemName} vendu ${prix}€`, url: '/chineuse/mes-ventes', tag: venteDocId })
          }
        } catch (e) { console.warn('Push notif failed:', e) }

        if (produitDoc) {
          const qty = parseInt(item.quantity) || 1
          const newQty = Math.max(0, (produitData.quantite || 1) - qty)
          const updateData: any = { quantite: newQty }
          if (newQty === 0) {
            let isSmallBatch = false
            if (trigramme) {
              const chineuseSnap = await adminDb.collection('chineuse')
                .where('trigramme', '==', trigramme)
                .limit(1)
                .get()
              if (!chineuseSnap.empty) {
                isSmallBatch = chineuseSnap.docs[0].data().stockType === 'smallBatch'
              }
            }
            if (isSmallBatch) {
              updateData.statut = 'outOfStock'
              updateData.dateRupture = saleTimestamp
              updateData.prixVenteReel = prix
            } else {
              updateData.vendu = true
              updateData.dateVente = saleTimestamp
              updateData.prixVenteReel = prix
            }
          }
          await adminDb.collection('produits').doc(produitDoc.id).update(updateData)
          console.log(`✅ Produit mis à jour: ${sku} → quantité ${newQty}`)
        }
      }
      return NextResponse.json({ received: true })
    }

    // === Vente en ligne (panier) ===
    const nomComplet = metadata.clientNom || ''
    const parts = nomComplet.trim().split(' ')
    const prenom = parts[0] || ''
    const nom = parts.slice(1).join(' ') || parts[0] || ''
    const clientInfo = {
      prenom,
      nom,
      email: metadata.clientEmail || '',
      telephone: metadata.clientTelephone || undefined
    }
    const modeLivraison = metadata.modeLivraison || null
    let adresse: any = null
    if (metadata.adresseLivraison) {
      try { adresse = JSON.parse(metadata.adresseLivraison) } catch {}
    }

    if (!clientInfo.email) {
      console.log('⚠️ Pas d\'infos client')
      return NextResponse.json({ received: true })
    }

    console.log('📦 Articles:', productIds.length, '— Client:', clientInfo.email)

    const numeroGroupe = genererNumeroGroupe(clientInfo.email, new Date())
    const lineItems = order?.lineItems || []

    const traitements: { commandeId: string; produitData: any; nouvelleQuantite: number }[] = []
    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i]
      const lineItem = lineItems[i] || null
      const lineItemPrice = lineItem?.basePriceMoney?.amount
        ? Number(lineItem.basePriceMoney.amount) / 100
        : 0
      const productNameFallback = lineItem?.name || 'Produit'

      try {
        const result = await traiterProduit({
          productId,
          paymentId,
          orderId,
          saleTimestamp,
          clientInfo,
          modeLivraison,
          adresse,
          numeroGroupe,
          lineItem,
          lineItemPrice,
          productNameFallback,
        })
        if (result) traitements.push(result)
      } catch (e: any) {
        console.error('❌ Erreur traitement produit', productId, e?.message)
      }
    }

    // Lier toutes les commandes du même panier entre elles
    if (traitements.length > 1) {
      const ids = traitements.map(t => t.commandeId)
      const batch = adminDb.batch()
      for (const id of ids) {
        const others = ids.filter(x => x !== id)
        batch.update(adminDb.collection('commandes').doc(id), {
          regroupeAvec: FieldValue.arrayUnion(...others)
        })
      }
      await batch.commit()
      console.log('✅ Commandes du panier liées entre elles')
    }

    // Email récap unique pour tout le panier
    if (traitements.length > 0) {
      const totalArticles = traitements.length
      const totalPrix = traitements.reduce((s, t) => s + (Number(t.produitData.prix) || 0), 0)
      const fraisLivraison = Number(metadata.fraisLivraison || 0)

      const articlesHtml = traitements.map(t => `
        <div style="padding: 12px 0; border-bottom: 1px solid #eee;">
          <p style="margin: 0;"><strong>${t.produitData.nom || 'Produit'}</strong></p>
          ${t.produitData.sku ? `<p style="margin: 2px 0; font-size: 12px; color: #666;">SKU: ${t.produitData.sku}</p>` : ''}
          ${t.produitData.marque ? `<p style="margin: 2px 0; font-size: 12px; color: #666;">${t.produitData.marque}</p>` : ''}
          <p style="margin: 4px 0 0 0;">${(t.produitData.prix || 0).toFixed(2)} €</p>
          ${t.nouvelleQuantite === 0 ? '<p style="color: #d32f2f; font-size: 12px; margin: 4px 0 0 0;">🗑️ Plus de stock</p>' : ''}
        </div>
      `).join('')

      try {
        const emailData = await resend.emails.send({
          from: 'Nouvelle Rive <onboarding@resend.dev>',
          to: 'nouvelleriveparis@gmail.com',
          subject: totalArticles > 1
            ? `🛒 Vente en ligne (${totalArticles} articles) - ${clientInfo.prenom} ${clientInfo.nom}`
            : `🎉 Vente en ligne - ${traitements[0].produitData.nom}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #22209C;">🎉 Nouvelle vente en ligne — ${totalArticles} article${totalArticles > 1 ? 's' : ''}</h1>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="margin-top: 0;">Articles vendus</h2>
                ${articlesHtml}
                <div style="padding-top: 12px; margin-top: 12px; border-top: 2px solid #000;">
                  <p style="margin: 0;">Sous-total : <strong>${totalPrix.toFixed(2)} €</strong></p>
                  ${fraisLivraison > 0 ? `<p style="margin: 4px 0 0 0;">Livraison : <strong>${fraisLivraison.toFixed(2)} €</strong></p>` : (modeLivraison === 'livraison' ? '<p style="margin: 4px 0 0 0; color: #0000FF;">Livraison offerte</p>' : '')}
                  <p style="margin: 8px 0 0 0; font-size: 18px;">Total : <strong>${(totalPrix + fraisLivraison).toFixed(2)} €</strong></p>
                </div>
              </div>

              <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="margin-top: 0;">Informations client</h2>
                <p><strong>Nom :</strong> ${clientInfo.prenom} ${clientInfo.nom}</p>
                <p><strong>Email :</strong> ${clientInfo.email}</p>
                ${clientInfo.telephone ? `<p><strong>Téléphone :</strong> ${clientInfo.telephone}</p>` : ''}
                <p><strong>Mode :</strong> ${modeLivraison === 'livraison' ? '📦 Livraison' : '🏪 Retrait en boutique'}</p>
                ${adresse ? `
                  <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 4px;">
                    <p style="margin: 0;"><strong>Adresse de livraison :</strong></p>
                    <p style="margin: 5px 0 0 0;">
                      ${adresse.adresse || adresse.rue || ''}<br>
                      ${adresse.codePostal || ''} ${adresse.ville || ''}<br>
                      ${adresse.pays || ''}
                    </p>
                  </div>
                ` : ''}
              </div>

              <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
                <h3 style="margin-top: 0; color: #c62828;">🚨 ACTION IMMÉDIATE REQUISE</h3>
                <p style="font-size: 16px; font-weight: bold; color: #c62828;">
                  1. RETIRER ${totalArticles > 1 ? 'LES ARTICLES' : "L'ARTICLE"} DE LA SURFACE DE VENTE
                </p>
                <p style="font-size: 16px; font-weight: bold; color: #c62828;">
                  2. ${modeLivraison === 'livraison' ? "PRÉPARER L'EXPÉDITION" : 'PRÉPARER LE RETRAIT'}
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin/commandes"
                   style="background: #22209C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  📋 Voir toutes les commandes
                </a>
              </div>

              <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px;">
                Commande Square : ${orderId}<br>
                Groupe : ${numeroGroupe}<br>
                ${new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </div>
          `
        })
        console.log('✅ Email envoyé:', emailData.data?.id)
      } catch (e: any) {
        console.error('❌ Erreur envoi email:', e?.message)
      }
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('❌ Erreur webhook:', error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}
