// src/app/api/checkout/route.ts
import { NextResponse } from 'next/server'
import { Client, Environment } from 'square'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

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

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: process.env.SQUARE_ENV === 'production' 
    ? Environment.Production 
    : Environment.Sandbox
})

export async function POST(request: Request) {
  try {
    const { 
      productId, 
      productName, 
      price, // Prix de base du produit (sans remise)
      imageUrl,
      clientInfo,
      adresse,
      modeLivraison
    } = await request.json()

    console.log('🔵 Création paiement Square...')
    console.log('Client:', clientInfo.email)
    console.log('Mode:', modeLivraison)
    console.log('Prix article:', price, '€')

    // =====================================================
    // 🆕 CALCUL DES PROMOTIONS BASÉ SUR LES COMMANDES DU JOUR
    // =====================================================
    
    const now = new Date()
    const debutJournee = new Date(now)
    debutJournee.setHours(0, 0, 0, 0)
    const finJournee = new Date(now)
    finJournee.setHours(23, 59, 59, 999)

    // Chercher les commandes du jour pour ce client
    const commandesAujourdhuiSnap = await adminDb
      .collection('commandes')
      .where('client.email', '==', clientInfo.email)
      .where('dateCommande', '>=', Timestamp.fromDate(debutJournee))
      .where('dateCommande', '<=', Timestamp.fromDate(finJournee))
      .get()

    const commandesAujourdhui = commandesAujourdhuiSnap.docs.map(doc => doc.data())
    const nombreAchatsAujourdhui = commandesAujourdhui.length

    console.log('📦 Commandes du jour pour ce client:', nombreAchatsAujourdhui)

    // Calculer les prix des articles déjà achetés aujourd'hui
    const prixArticlesPrecedents = commandesAujourdhui.map(c => c.prix || 0)
    
    // Prix final à payer
    let prixFinal = price
    let remiseAppliquee = 0
    let fraisLivraison = 0
    let livraisonOfferte = false

    // 🚚 FRAIS DE LIVRAISON
    if (modeLivraison === 'livraison') {
      if (nombreAchatsAujourdhui >= 1) {
        // Dès le 2e achat du jour → livraison offerte
        livraisonOfferte = true
        console.log('🎁 Livraison offerte (2e achat ou +)')
      } else {
        // 1er achat → 15€ de livraison
        fraisLivraison = 15
        console.log('🚚 Frais de livraison: 15€')
      }
    }

    // 💜 REMISE -15% SUR L'ARTICLE LE MOINS CHER (dès le 3e achat)
    if (nombreAchatsAujourdhui >= 2) {
      // C'est au moins le 3e achat du jour
      // Trouver le prix minimum parmi TOUS les articles (précédents + actuel)
      const tousLesPrix = [...prixArticlesPrecedents, price]
      const prixMinimum = Math.min(...tousLesPrix)
      
      // Vérifier si la remise a déjà été appliquée sur une commande précédente
      const remiseDejaAppliquee = commandesAujourdhui.some(c => c.remiseAppliquee && c.remiseAppliquee > 0)
      
      if (!remiseDejaAppliquee) {
        // Appliquer la remise de 15% du prix minimum
        remiseAppliquee = prixMinimum * 0.15
        prixFinal = price - remiseAppliquee
        console.log('💜 Remise -15% sur article le moins cher:', prixMinimum, '€')
        console.log('💜 Remise appliquée:', remiseAppliquee.toFixed(2), '€')
      } else {
        console.log('ℹ️ Remise déjà appliquée sur une commande précédente')
      }
    }

    // Ajouter les frais de livraison au total
    prixFinal = prixFinal + fraisLivraison

    console.log('💰 Prix final à payer:', prixFinal.toFixed(2), '€')

    // =====================================================
    // CRÉATION DE L'ORDRE SQUARE
    // =====================================================

    const idempotencyKey = `${productId}-${Date.now()}`
    
    // Construire les metadata
    const metadata: any = {
      productId,
      clientEmail: clientInfo.email,
      clientNom: `${clientInfo.prenom} ${clientInfo.nom}`,
      modeLivraison,
      nombreAchats: (nombreAchatsAujourdhui + 1).toString(),
      prixOriginal: price.toString(),
      remiseAppliquee: remiseAppliquee.toString(),
      fraisLivraison: fraisLivraison.toString()
    }

    // Ajouter le téléphone uniquement s'il existe
    if (clientInfo.telephone && clientInfo.telephone.trim() !== '') {
      metadata.clientTelephone = clientInfo.telephone
    }

    // Ajouter l'adresse si livraison
    if (modeLivraison === 'livraison' && adresse) {
      metadata.adresseLivraison = JSON.stringify(adresse)
    }

    // Construire les line items
    const lineItems: any[] = [
      {
        name: productName,
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(Math.round(price * 100)),
          currency: 'EUR'
        },
        note: imageUrl ? `Image: ${imageUrl}` : undefined
      }
    ]

    // Ajouter la remise si applicable
    if (remiseAppliquee > 0) {
      lineItems.push({
        name: '🎁 Remise -15% (3e achat)',
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(-Math.round(remiseAppliquee * 100)),
          currency: 'EUR'
        }
      })
    }

    // Ajouter les frais de livraison si applicable
    if (fraisLivraison > 0) {
      lineItems.push({
        name: '🚚 Frais de livraison',
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(Math.round(fraisLivraison * 100)),
          currency: 'EUR'
        }
      })
    }

    // Ajouter mention livraison offerte si applicable
    if (livraisonOfferte && modeLivraison === 'livraison') {
      lineItems.push({
        name: '🎁 Livraison offerte',
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(0),
          currency: 'EUR'
        }
      })
    }

    const orderData: any = {
      locationId: process.env.SQUARE_LOCATION_ID!,
      lineItems,
      metadata
    }

    const orderResponse = await client.ordersApi.createOrder({
      order: orderData,
      idempotencyKey
    })

    const orderId = orderResponse.result.order?.id

    if (!orderId) {
      throw new Error('Ordre non créé')
    }

    console.log('✅ Ordre créé:', orderId)

    // Préparer les données pré-remplies pour Square
const prePopulatedData: any = {
  buyerEmail: clientInfo.email,
  buyerAddress: {
    firstName: clientInfo.prenom,
    lastName: clientInfo.nom,
  }
}

// Ajouter le téléphone uniquement s'il existe
if (clientInfo.telephone && clientInfo.telephone.trim() !== '') {
  prePopulatedData.buyerPhoneNumber = clientInfo.telephone
}

// Ajouter l'adresse complète si livraison
if (modeLivraison === 'livraison' && adresse) {
  prePopulatedData.buyerAddress = {
    ...prePopulatedData.buyerAddress,
    addressLine1: adresse.rue,
    locality: adresse.ville,
    postalCode: adresse.codePostal,
    country: 'FR'
  }
}

    // Créer le lien de paiement Square
    const checkoutResponse = await client.checkoutApi.createPaymentLink({
      idempotencyKey: `checkout-${idempotencyKey}`,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        lineItems,
        metadata
      },
      checkoutOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/confirmation?orderId=${orderId}&productId=${productId}`,
        askForShippingAddress: modeLivraison === 'livraison'
      },
      prePopulatedData
    })

    const checkoutUrl = checkoutResponse.result.paymentLink?.url

    if (!checkoutUrl) {
      throw new Error('Lien de paiement non créé')
    }

    console.log('✅ Lien de paiement créé')

    return NextResponse.json({ 
      success: true,
      orderId,
      checkoutUrl,
      // Infos pour debug / affichage
      promotions: {
        nombreAchatsAujourdhui: nombreAchatsAujourdhui + 1,
        remiseAppliquee,
        fraisLivraison,
        livraisonOfferte,
        prixFinal
      }
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