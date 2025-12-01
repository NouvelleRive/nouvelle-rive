// app/api/delete-produits/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production,
})

type Reason = 'erreur' | 'produit_recupere'

export async function POST(req: NextRequest) {
  try {
    const { productId, reason } = await req.json()
    const justif: Reason = reason === 'produit_recupere' ? 'produit_recupere' : 'erreur'

    if (!productId) {
      return NextResponse.json({ success: false, error: 'productId manquant' }, { status: 400 })
    }

    // --- Auth Bearer ---
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    }
    
    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(token)
    } catch (authError: any) {
      console.error('❌ Erreur vérification token:', authError?.message)
      return NextResponse.json({ success: false, error: 'Token invalide' }, { status: 401 })
    }

    const userEmail = String(decoded?.email || '')
    const isAdmin = userEmail === ADMIN_EMAIL

    // Récupérer le produit
    const produitRef = adminDb.collection('produits').doc(String(productId))
    const produitSnap = await produitRef.get()

    if (!produitSnap.exists) {
      return NextResponse.json({ success: false, error: 'Produit non trouvé' }, { status: 404 })
    }

    const data = produitSnap.data() as any

    // Vérifier que l'utilisateur est admin ou propriétaire
    if (!isAdmin && data.chineurUid !== decoded?.uid) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 403 })
    }

    // --- Square : suppression ---
    const squareIds: string[] = []
    if (data?.variationId) squareIds.push(String(data.variationId))
    if (data?.catalogObjectId) squareIds.push(String(data.catalogObjectId))
    if (data?.itemId) squareIds.push(String(data.itemId))

    if (squareIds.length > 0) {
      try {
        await squareClient.catalogApi.batchDeleteCatalogObjects({
          objectIds: squareIds,
        })
        console.log('✅ Square: supprimé', squareIds)
      } catch (squareError: any) {
        console.error('Square delete error:', squareError?.message)
        // On continue même si Square échoue
      }
    }

    // --- Firestore ---
    if (justif === 'produit_recupere') {
      await produitRef.update({
        statut: 'retour',
        dateRetour: FieldValue.serverTimestamp(),
        derniereAction: 'retour',
      })
    } else {
      await produitRef.delete()
    }

    console.log(`✅ Produit ${productId} ${justif === 'produit_recupere' ? 'retourné' : 'supprimé'}`)

    return NextResponse.json({
      success: true,
      action: justif === 'produit_recupere' ? 'retour' : 'delete',
    })

  } catch (e: any) {
    console.error('❌ [API DELETE PRODUITS]', e?.message || e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}