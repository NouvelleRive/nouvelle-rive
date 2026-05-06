// src/app/api/checkout/route.ts
import { NextResponse } from 'next/server'
import { Client, Environment } from 'square'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getFraisLivraison } from '@/lib/shipping'

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
      paysCode
    }: {
      items: ItemPanier[]
      clientInfo: { prenom: string; nom: string; email: string; telephone?: string }
      adresse: any
      modeLivraison: 'retrait' | 'livraison'
      paysCode?: string
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
    const prixServeur: { id: string; nom: string; prix: number }[] = []
    for (const it of items) {
      const snap = await adminDb.collection('produits').doc(it.id).get()
      if (!snap.exists) {
        return NextResponse.json({ success: false, error: `Produit ${it.id} introuvable` }, { status: 400 })
      }
      const d = snap.data() as any
      if (d.vendu === true) {
        return NextResponse.json({ success: false, error: `Produit ${it.nom || it.id} déjà vendu`, soldOutId: it.id }, { status: 409 })
      }
      prixServeur.push({ id: it.id, nom: d.nom || it.nom, prix: Number(d.prix) || 0 })
    }

    const sousTotal = prixServeur.reduce((s, p) => s + p.prix, 0)

    let fraisLivraison = 0
    if (modeLivraison === 'livraison') {
      fraisLivraison = getFraisLivraison(codePays, sousTotal)
    }

    const totalFinal = sousTotal + fraisLivraison
    console.log('💰 Sous-total:', sousTotal.toFixed(2), '€ — Livraison:', fraisLivraison, '€ — Total:', totalFinal.toFixed(2), '€')

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

    if (clientInfo.telephone && clientInfo.telephone.trim() !== '') {
      metadata.clientTelephone = clientInfo.telephone
    }

    if (modeLivraison === 'livraison' && adresse) {
      metadata.adresseLivraison = JSON.stringify(adresse)
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
        ].filter(Boolean).join(' | ').substring(0, 500)
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
        metadata
      },
      idempotencyKey
    })

    const orderId = orderResponse.result.order?.id
    if (!orderId) throw new Error('Ordre non créé')

    console.log('✅ Ordre créé:', orderId)

    const prePopulatedData: any = {
      buyerEmail: clientInfo.email,
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
