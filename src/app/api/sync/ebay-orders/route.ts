// src/app/api/sync/ebay-orders/route.ts
//
// Polling des commandes eBay (API Fulfillment).
// L'API de notifications eBay ne pousse pas d'événement fiable pour les ventes ;
// le polling toutes les 10 min est la méthode officielle recommandée.
//
// Idempotent : doc IDs déterministes `ebay_${orderId}_${lineItemId}` avec set(merge:true).
// Cron-friendly : peut être appelé sans corps (GET ou POST). En prod, Vercel Cron envoie
// l'en-tête `Authorization: Bearer ${CRON_SECRET}` (cf. https://vercel.com/docs/cron-jobs).

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import { ebayApiCall, isEbayConfigured, convertEURtoUSD } from '@/lib/ebay'
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

// Reverse de convertEURtoUSD (taux 1.08 défini dans lib/ebay/clients.ts)
function usdToEur(usd: number): number {
  return Math.round((usd / 1.08) * 100) / 100
}

type EbayOrder = {
  orderId: string
  creationDate: string
  orderFulfillmentStatus?: string
  orderPaymentStatus?: string
  cancelStatus?: { cancelState?: string }
  lineItems?: Array<{
    lineItemId: string
    sku?: string
    title?: string
    quantity?: number
    total?: { value: string; currency: string }
    lineItemCost?: { value: string; currency: string }
  }>
  buyer?: { username?: string }
}

async function syncEbayOrders(daysBack: number = 14) {
  if (!isEbayConfigured()) {
    return { ok: false, reason: 'eBay non configuré' }
  }

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
  const sinceIso = since.toISOString()

  const filter = `creationdate:[${sinceIso}..]`
  const endpoint = `/sell/fulfillment/v1/order?filter=${encodeURIComponent(filter)}&limit=200`

  console.log('🔄 Sync eBay orders depuis', sinceIso)

  const response = await ebayApiCall<{ orders?: EbayOrder[]; total?: number }>(endpoint)
  const orders = response.orders || []
  console.log(`📥 ${orders.length} commandes eBay récupérées`)

  let traitees = 0
  let nouvelles = 0
  let ignorees = 0
  const erreurs: string[] = []

  for (const order of orders) {
    // Skip si commande annulée
    if (order.cancelStatus?.cancelState === 'CANCELED') {
      ignorees++
      continue
    }
    // Ne traiter que les commandes payées
    if (order.orderPaymentStatus && order.orderPaymentStatus !== 'PAID') {
      ignorees++
      continue
    }

    const orderId = order.orderId
    const saleDate = order.creationDate ? new Date(order.creationDate) : new Date()
    const saleTimestamp = Timestamp.fromDate(saleDate)

    for (const item of order.lineItems || []) {
      traitees++
      const sku = item.sku
      const lineItemId = item.lineItemId
      const venteDocId = `ebay_${orderId}_${lineItemId}`

      const venteRef = adminDb.collection('ventes').doc(venteDocId)
      const existingVente = await venteRef.get()
      if (existingVente.exists) {
        // Déjà synchronisée
        continue
      }

      const totalValue = parseFloat(item.total?.value || item.lineItemCost?.value || '0')
      const currency = item.total?.currency || item.lineItemCost?.currency || 'USD'
      const prixEur = currency === 'EUR' ? totalValue : usdToEur(totalValue)
      const quantity = item.quantity || 1

      // Recherche du produit Firestore par SKU
      let produitDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null
      let produitData: any = null

      if (sku) {
        const skuUpper = sku.toUpperCase()
        const snap = await adminDb.collection('produits').where('sku', '==', skuUpper).limit(1).get()
        if (!snap.empty) {
          produitDoc = snap.docs[0] as any
          produitData = produitDoc!.data()
        } else {
          // Fallback : chercher par doc ID == sku (ancien format)
          const direct = await adminDb.collection('produits').doc(sku).get()
          if (direct.exists) {
            produitDoc = direct as any
            produitData = direct.data()
          }
        }
      }

      const trigramme = (produitData?.sku || sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || null
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

      // Écriture vente (idempotent grâce au doc ID déterministe)
      const venteData = {
        orderId,
        lineItemUid: lineItemId,
        dateVente: saleTimestamp,
        prixVenteReel: prixEur,
        prixVenteOriginal: totalValue,
        prixVenteCurrency: currency,
        quantite: quantity,
        nomSquare: item.title || produitData?.nom || sku || '',
        produitId: produitDoc?.id || null,
        nom: produitData?.nom || item.title || '',
        sku: produitData?.sku || sku || null,
        skuSquare: sku || null,
        chineur: chineurEmail,
        chineurUid,
        trigramme,
        prixInitial: produitData?.prix || null,
        attribue: !!produitDoc,
        source: 'ebay',
        skuSource: 'cron_ebay',
        venduSur: 'ebay',
        createdAt: saleTimestamp,
      }
      await venteRef.set(venteData, { merge: true })
      nouvelles++
      console.log(`✅ Vente eBay créée: ${sku || item.title} [${venteDocId}]`)

      // Mise à jour du produit
      if (produitDoc) {
        const quantiteActuelle = produitData.quantite || 1
        const nouvQuantite = Math.max(0, quantiteActuelle - quantity)

        let isSmallBatch = false
        if (trigramme && nouvQuantite === 0) {
          const chineuseSnap = await adminDb.collection('chineuse')
            .where('trigramme', '==', trigramme)
            .limit(1)
            .get()
          if (!chineuseSnap.empty) {
            isSmallBatch = chineuseSnap.docs[0].data().stockType === 'smallBatch'
          }
        }

        const updateData: any = { quantite: nouvQuantite }
        if (nouvQuantite === 0) {
          if (isSmallBatch) {
            updateData.statut = 'outOfStock'
            updateData.dateRupture = saleTimestamp
            updateData.prixVenteReel = prixEur
          } else {
            updateData.vendu = true
            updateData.dateVente = saleTimestamp
            updateData.prixVenteReel = prixEur
            updateData.venduSur = 'ebay'
          }
        }
        await produitDoc.ref.update(updateData)

        // Retirer du Square si épuisé (la vente vient d'eBay)
        if (nouvQuantite === 0 && !isSmallBatch) {
          try {
            await removeFromAllChannels(
              {
                id: produitDoc.id,
                sku: produitData.sku,
                squareId: produitData.squareId,
                ebayOfferId: produitData.ebayOfferId,
                ebayListingId: produitData.ebayListingId,
              },
              'ebay'
            )
          } catch (e: any) {
            console.error('⚠️ Retrait Square échoué (non bloquant):', e?.message)
          }
        }

        // Push notif
        try {
          const titre = `🇺🇸 Vente eBay : ${produitData.sku || produitData.nom}`
          const corps = `${prixEur.toFixed(2)}€ — ${item.title || ''}`
          await sendPushToOwner('boutique', { title: titre, body: corps, url: '/admin/nos-ventes', tag: venteDocId })
          if (chineurUid) {
            await sendPushToOwner(chineurUid, {
              title: '🎉 Vente eBay !',
              body: `${produitData.sku || produitData.nom} — ${prixEur.toFixed(2)}€`,
              url: '/chineuse/mes-ventes',
              tag: venteDocId,
            })
          }
        } catch (e) { console.warn('Push notif failed:', e) }

        // Email récap
        try {
          await resend.emails.send({
            from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
            to: 'nouvelleriveparis@gmail.com',
            subject: `🇺🇸 Vente eBay : ${produitData.nom || sku}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #22209C;">🇺🇸 Nouvelle vente eBay</h1>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Produit :</strong> ${produitData.nom || item.title || ''}</p>
                  ${produitData.sku ? `<p><strong>SKU :</strong> ${produitData.sku}</p>` : ''}
                  ${produitData.marque ? `<p><strong>Marque :</strong> ${produitData.marque}</p>` : ''}
                  <p><strong>Prix vendu :</strong> ${totalValue.toFixed(2)} ${currency} (≈ ${prixEur.toFixed(2)} €)</p>
                  <p><strong>Quantité restante :</strong> ${nouvQuantite}</p>
                  ${nouvQuantite === 0 ? '<p style="color: #d32f2f; font-weight: bold;">🗑️ Plus de stock — retiré des autres canaux</p>' : ''}
                </div>
                <div style="background: #ffebee; padding: 20px; border-radius: 8px; border-left: 4px solid #f44336;">
                  <h3 style="margin-top: 0; color: #c62828;">🚨 PRÉPARER L'EXPÉDITION INTERNATIONALE</h3>
                </div>
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  Order eBay : ${orderId}<br>
                  Acheteur : ${order.buyer?.username || 'inconnu'}
                </p>
              </div>
            `
          })
        } catch (e: any) {
          console.error('⚠️ Email échoué (non bloquant):', e?.message)
        }
      } else {
        // Pas de produit trouvé — vente créée mais non attribuée. Email de signalement.
        erreurs.push(`Produit non trouvé pour SKU eBay: ${sku || lineItemId}`)
        try {
          await resend.emails.send({
            from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
            to: 'nouvelleriveparis@gmail.com',
            subject: `⚠️ Vente eBay non attribuée : ${sku || lineItemId}`,
            html: `<p>Une vente eBay (${totalValue} ${currency}) n'a pas pu être attribuée à un produit Firestore.</p>
              <p>SKU eBay : <code>${sku || '(absent)'}</code></p>
              <p>Titre : ${item.title || ''}</p>
              <p>Order : ${orderId}</p>`
          })
        } catch {}
      }
    }
  }

  return { ok: true, traitees, nouvelles, ignorees, erreurs }
}

function checkAuth(req: NextRequest): { ok: boolean; reason?: string } {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return { ok: true } // pas de secret configuré : ouvert (utile en dev)
  const auth = req.headers.get('authorization') || ''
  if (auth === `Bearer ${cronSecret}`) return { ok: true }
  return { ok: false, reason: 'Unauthorized' }
}

export async function GET(req: NextRequest) {
  const auth = checkAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })

  try {
    const url = new URL(req.url)
    const days = parseInt(url.searchParams.get('days') || '14') || 14
    const result = await syncEbayOrders(days)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('❌ Sync eBay échoué:', err)
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = checkAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const days = parseInt(body?.days) || 14
    const result = await syncEbayOrders(days)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('❌ Sync eBay échoué:', err)
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
