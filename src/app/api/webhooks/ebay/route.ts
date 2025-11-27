// app/api/webhooks/ebay/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { Resend } from 'resend'
import { removeFromAllChannels } from '@/lib/syncRemoveFromAllChannels'

// Init Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()
const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * GET /api/webhooks/ebay
 * Challenge eBay pour vérifier l'endpoint
 */
export async function GET(request: NextRequest) {
  const challengeCode = request.nextUrl.searchParams.get('challenge_code')
  
  if (challengeCode) {
    // eBay envoie un challenge pour vérifier l'endpoint
    const verificationToken = process.env.EBAY_VERIFICATION_TOKEN || ''
    const endpoint = process.env.EBAY_WEBHOOK_ENDPOINT || ''
    
    // Créer le hash de réponse
    const crypto = await import('crypto')
    const hash = crypto
      .createHash('sha256')
      .update(challengeCode + verificationToken + endpoint)
      .digest('hex')
    
    return NextResponse.json({ challengeResponse: hash })
  }
  
  return NextResponse.json({ status: 'ok' })
}

/**
 * POST /api/webhooks/ebay
 * Reçoit les notifications de vente eBay
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('📥 Webhook eBay reçu:', JSON.stringify(body, null, 2))
    
    const topic = body?.metadata?.topic || body?.topic
    
    // Vérifier le type de notification
    if (topic === 'MARKETPLACE.ORDER.PURCHASE' || topic === 'ITEM_SOLD') {
      await handleOrderNotification(body)
    } else if (topic === 'ACCOUNT_DELETION') {
      console.log('🗑️ Notification suppression compte eBay ignorée')
    } else {
      console.log(`⏭️ Topic non géré: ${topic}`)
    }
    
    return NextResponse.json({ received: true })
    
  } catch (error: any) {
    console.error('❌ Erreur webhook eBay:', error)
    // Toujours retourner 200 pour éviter les retries eBay
    return NextResponse.json({ received: true, error: error?.message })
  }
}

/**
 * Traite une notification de commande/vente
 */
async function handleOrderNotification(body: any) {
  const resource = body?.resource || body
  const lineItems = resource?.lineItems || []
  
  for (const item of lineItems) {
    const sku = item?.sku || item?.SKU
    const quantity = item?.quantity || 1
    const priceUSD = parseFloat(item?.total?.value || item?.price?.value || '0')
    
    if (!sku) {
      console.warn('⚠️ Ligne sans SKU, ignorée')
      continue
    }
    
    console.log(`🛒 Vente eBay: SKU=${sku}, Qty=${quantity}, Prix=$${priceUSD}`)
    
    // Chercher le produit dans Firebase par SKU
    let snap = await db.collection('produits').where('sku', '==', sku).get()
    
    // Fallback: chercher par ID
    if (snap.empty) {
      const docRef = db.collection('produits').doc(sku)
      const docSnap = await docRef.get()
      if (docSnap.exists) {
        snap = { docs: [docSnap], empty: false } as any
      }
    }
    
    if (snap.empty) {
      console.warn(`❓ Produit non trouvé pour SKU: ${sku}`)
      continue
    }
    
    for (const docSnap of snap.docs) {
      const produitData: any = docSnap.data()
      const quantiteActuelle = produitData.quantite || 1
      const nouvQuantite = Math.max(0, quantiteActuelle - quantity)
      
      // Créer entrée dans collection ventes
      await db.collection('ventes').add({
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
        prixVenteReel: priceUSD,
        dateVente: Timestamp.now(),
        source: 'ebay',
        createdAt: Timestamp.now(),
      })
      
      // Mise à jour du produit
      const updateData: any = {
        quantite: nouvQuantite,
      }
      
      if (nouvQuantite === 0) {
        updateData.vendu = true
        updateData.dateVente = Timestamp.now()
        updateData.prixVenteReel = priceUSD
        updateData.venduSur = 'ebay'
        
        // Retirer des autres canaux (Square)
        await removeFromAllChannels(
          {
            id: docSnap.id,
            sku: produitData.sku,
            squareId: produitData.squareId,
            ebayOfferId: produitData.ebayOfferId,
            ebayListingId: produitData.ebayListingId,
          },
          'ebay' // Exclure eBay car la vente vient de là
        )
      }
      
      await docSnap.ref.update(updateData)
      
      console.log(`✅ Produit mis à jour: ${docSnap.id}, quantité: ${nouvQuantite}`)
      
      // Email notification
      await sendSaleNotification(produitData, priceUSD)
    }
  }
}

/**
 * Envoie un email de notification de vente
 */
async function sendSaleNotification(produit: any, priceUSD: number) {
  try {
    await resend.emails.send({
      from: 'Nouvelle Rive <noreply@nouvellerive.com>',
      to: ['nouvelleriveparis@gmail.com', 'nouvellerivecommandes@gmail.com'],
      subject: `🇺🇸 Vente eBay: ${produit.nom}`,
      html: `
        <h2>Nouvelle vente sur eBay!</h2>
        <p><strong>Produit:</strong> ${produit.nom}</p>
        <p><strong>SKU:</strong> ${produit.sku}</p>
        <p><strong>Marque:</strong> ${produit.marque || 'N/A'}</p>
        <p><strong>Prix:</strong> $${priceUSD} USD</p>
        <p><strong>Chineur:</strong> ${produit.chineur}</p>
        <hr>
        <p>Pensez à préparer l'expédition internationale!</p>
      `,
    })
    console.log('📧 Email notification envoyé')
  } catch (error) {
    console.error('⚠️ Erreur envoi email (non bloquant):', error)
  }
}