// src/app/api/checkout/route.ts
import { NextResponse } from 'next/server'
import { Client, Environment } from 'square'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getFraisLivraison } from '@/lib/shipping'
import { lireCodePromo } from '@/lib/codesPromo'
import { OPERATION_EN_COURS, remiseEffective, prixClient } from '@/lib/remiseOperation'

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

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: process.env.SQUARE_ENV === 'production'
    ? Environment.Production
    : Environment.Sandbox
})

type ItemPanier = {
  id: string
  nom: string
  prix: number
  imageUrl?: string | null
}

const cleanProductName = (nom: string) => nom.replace(/^[A-Z]+\d*\s*[-–]\s*/i, '')

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      items,
      clientInfo,
      adresse,
      modeLivraison,
      paysCode,
      attribution,
      fbp,
      fbc,
      consent,
      promoCode
    }: {
      items: ItemPanier[]
      clientInfo: { prenom: string; nom: string; email: string; telephone?: string }
      adresse: any
      modeLivraison: 'retrait' | 'livraison'
      paysCode?: string
      promoCode?: string | null
      attribution?: {
        utm_source?: string
        utm_medium?: string
        utm_campaign?: string
        utm_content?: string
        utm_term?: string
        fbclid?: string
      }
      fbp?: string
      fbc?: string
      consent?: 'granted' | 'denied' | null
    } = body

    const codePays = (paysCode || adresse?.paysCode || 'FR').toUpperCase()

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Panier vide' }, { status: 400 })
    }

    console.log('🔵 Création paiement Square (panier multi-articles)')
    console.log('Client:', clientInfo.email)
    console.log('Articles:', items.length)
    console.log('Mode:', modeLivraison)

    // Recharger les prix côté serveur pour éviter qu'un client trafique le prix
    const prixServeur: { id: string; nom: string; prix: number; sku: string; bw: number }[] = []
    for (const it of items) {
      const snap = await adminDb.collection('produits').doc(it.id).get()
      if (!snap.exists) {
        return NextResponse.json({ success: false, error: `Produit ${it.id} introuvable` }, { status: 400 })
      }
      const d = snap.data() as any
      if (d.vendu === true) {
        return NextResponse.json({ success: false, error: `Produit ${it.nom || it.id} déjà vendu`, soldOutId: it.id }, { status: 409 })
      }
      prixServeur.push({ id: it.id, nom: d.nom || it.nom, prix: Number(d.prix) || 0, sku: String(d.sku || '').toUpperCase(), bw: remiseEffective(OPERATION_EN_COURS, Number(d.remiseBlackWeek) || 0) })
    }

    const sousTotal = prixServeur.reduce((s, p) => s + p.prix, 0)

    // Black Week (lib/remiseOperation) : remise par pièce, uniquement pendant la période.
    const remiseBW = prixServeur.reduce((s, p) => s + (p.bw ? p.prix - prixClient(p.prix, p.bw) : 0), 0)

    let fraisLivraison = 0
    if (modeLivraison === 'livraison') {
      fraisLivraison = getFraisLivraison(codePays, sousTotal - remiseBW)
    }

    // Code promo ciblé (lib/codesPromo) : remise sur les seules pièces listées,
    // jamais sur la livraison. Financée par NR : la vente chineuse reste au prix plein.
    const promo = promoCode ? await lireCodePromo(String(promoCode)) : null
    if (promoCode && String(promoCode).trim() && !promo) {
      return NextResponse.json({ success: false, error: 'Code promo invalide', promoInvalid: true }, { status: 400 })
    }
    // Pas de cumul : une pièce en Black Week n'est pas éligible au code promo.
    const eligible = (p: { sku: string; bw: number }) => !!promo && !p.bw && promo.skus.includes(p.sku)
    const remise = promo
      ? prixServeur.filter(eligible).reduce((s, p) => s + Math.round(p.prix * promo.remisePct) / 100, 0)
      : 0
    const DISCOUNT_UID = 'code-promo'
    const listeDiscounts: { uid: string; name: string; percentage: string; scope: 'LINE_ITEM' }[] = []
    if (promo && remise > 0) listeDiscounts.push({ uid: DISCOUNT_UID, name: `${promo.code} -${promo.remisePct}%`, percentage: String(promo.remisePct), scope: 'LINE_ITEM' })
    for (const pct of Array.from(new Set(prixServeur.filter(p => p.bw).map(p => p.bw)))) {
      listeDiscounts.push({ uid: `bw-${pct}`, name: `${OPERATION_EN_COURS.label} -${pct} %`, percentage: String(pct), scope: 'LINE_ITEM' })
    }
    const discounts = listeDiscounts.length ? listeDiscounts : undefined

    const totalFinal = sousTotal - remise - remiseBW + fraisLivraison
    console.log('💰 Sous-total:', sousTotal.toFixed(2), '€ — Remise:', remise.toFixed(2), '€ — Livraison:', fraisLivraison, '€ — Total:', totalFinal.toFixed(2), '€')

    const idempotencyKey = `cart-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    const productIds = prixServeur.map(p => p.id).join(',')

    const metadata: any = {
      productIds,
      clientEmail: clientInfo.email,
      clientNom: `${clientInfo.prenom} ${clientInfo.nom}`,
      modeLivraison,
      nombreArticles: prixServeur.length.toString(),
      sousTotal: sousTotal.toString(),
      fraisLivraison: fraisLivraison.toString(),
    }
    if (promo && remise > 0) {
      metadata.promoCode = promo.code
      metadata.remise = remise.toFixed(2)
    }
    if (remiseBW > 0) metadata.remiseBlackWeek = remiseBW.toFixed(2)

    if (clientInfo.telephone && clientInfo.telephone.trim() !== '') {
      metadata.clientTelephone = clientInfo.telephone
    }

    if (modeLivraison === 'livraison' && adresse) {
      metadata.adresseLivraison = JSON.stringify(adresse)
    }

    // Attribution marketing (survit à l'aller-retour Square → webhook).
    // Valeurs Square metadata : max 255 caractères par champ.
    const putMeta = (k: string, v?: string | null) => {
      if (v && String(v).trim() !== '') metadata[k] = String(v).slice(0, 255)
    }
    putMeta('utmSource', attribution?.utm_source)
    putMeta('utmMedium', attribution?.utm_medium)
    putMeta('utmCampaign', attribution?.utm_campaign)
    putMeta('utmContent', attribution?.utm_content)
    putMeta('utmTerm', attribution?.utm_term)
    putMeta('fbclid', attribution?.fbclid)
    if (consent === 'granted') {
      metadata.mktConsent = '1'
      putMeta('fbp', fbp)
      putMeta('fbc', fbc)
    }

    const lineItems: any[] = prixServeur.map((p, idx) => {
      const original = items[idx]
      return {
        name: cleanProductName(p.nom),
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(Math.round(p.prix * 100)),
          currency: 'EUR'
        },
        note: [
          `productId:${p.id}`,
          original?.imageUrl ? `Image: ${original.imageUrl}` : null
        ].filter(Boolean).join(' | ').substring(0, 500),
        ...(p.bw ? { appliedDiscounts: [{ discountUid: `bw-${p.bw}` }] } : eligible(p) ? { appliedDiscounts: [{ discountUid: DISCOUNT_UID }] } : {})
      }
    })

    if (fraisLivraison > 0) {
      lineItems.push({
        name: 'Frais de livraison',
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(Math.round(fraisLivraison * 100)),
          currency: 'EUR'
        }
      })
    } else if (modeLivraison === 'livraison') {
      lineItems.push({
        name: '🎁 Livraison offerte',
        quantity: '1',
        basePriceMoney: { amount: BigInt(0), currency: 'EUR' }
      })
    }

    const orderResponse = await client.ordersApi.createOrder({
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        lineItems,
        ...(discounts ? { discounts } : {}),
        metadata
      },
      idempotencyKey
    })

    const orderId = orderResponse.result.order?.id
    if (!orderId) throw new Error('Ordre non créé')

    console.log('✅ Ordre créé:', orderId)

    // On NE pré-remplit PAS buyerEmail : sans email côté Square, Square n'envoie pas
    // son reçu automatique. C'est Nouvelle Rive qui envoie ses propres emails
    // (confirmation, expédition…). On garde nom/adresse pour la logistique.
    const prePopulatedData: any = {
      buyerAddress: {
        firstName: clientInfo.prenom,
        lastName: clientInfo.nom,
      }
    }

    if (clientInfo.telephone && clientInfo.telephone.trim() !== '') {
      prePopulatedData.buyerPhoneNumber = clientInfo.telephone
    }

    if (modeLivraison === 'livraison' && adresse) {
      prePopulatedData.buyerAddress = {
        ...prePopulatedData.buyerAddress,
        addressLine1: adresse.adresse || adresse.rue,
        locality: adresse.ville,
        postalCode: adresse.codePostal,
        country: codePays
      }
    }

    const checkoutResponse = await client.checkoutApi.createPaymentLink({
      idempotencyKey: `checkout-${idempotencyKey}`,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        lineItems,
        ...(discounts ? { discounts } : {}),
        metadata
      },
      checkoutOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/confirmation?orderId=${orderId}&productIds=${encodeURIComponent(productIds)}`,
        askForShippingAddress: modeLivraison === 'livraison'
      },
      prePopulatedData
    })

    const checkoutUrl = checkoutResponse.result.paymentLink?.url
    if (!checkoutUrl) throw new Error('Lien de paiement non créé')

    console.log('✅ Lien de paiement créé')

    return NextResponse.json({
      success: true,
      orderId,
      checkoutUrl,
      total: totalFinal,
      sousTotal,
      fraisLivraison,
    })

  } catch (error: any) {
    console.error('❌ Erreur Square:', error)
    console.error('Détails:', error.errors || error.body)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.errors || error.body
    }, { status: 500 })
  }
}
