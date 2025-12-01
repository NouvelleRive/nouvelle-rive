// app/api/delete-produits-batch/route.ts
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
    const { productIds, reason } = await req.json()
    const justif: Reason = reason === 'produit_recupere' ? 'produit_recupere' : 'erreur'

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ success: false, error: 'productIds manquant ou vide' }, { status: 400 })
    }

    // Limite à 100 produits par requête
    if (productIds.length > 100) {
      return NextResponse.json({ success: false, error: 'Maximum 100 produits par requête' }, { status: 400 })
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

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Accès admin requis pour suppression en masse' }, { status: 403 })
    }

    // --- Récupérer tous les produits en parallèle ---
    const refs = productIds.map(id => adminDb.collection('produits').doc(String(id)))
    const snapshots = await adminDb.getAll(...refs)

    // Collecter tous les IDs Square à supprimer
    const allSquareIds = new Set<string>()
    const validProducts: { ref: FirebaseFirestore.DocumentReference; data: any }[] = []

    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i]
      if (snap.exists) {
        const data = snap.data() as any
        validProducts.push({ ref: refs[i], data })
        
        // Collecter IDs Square
        if (data?.variationId) allSquareIds.add(String(data.variationId))
        if (data?.catalogObjectId) allSquareIds.add(String(data.catalogObjectId))
        if (data?.itemId) allSquareIds.add(String(data.itemId))
      }
    }

    if (validProducts.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun produit trouvé' }, { status: 404 })
    }

    // --- Square : suppression batch ---
    const squareResults = { deleted: 0, notFound: 0, failed: 0 }
    
    if (allSquareIds.size > 0) {
      const idsArray = Array.from(allSquareIds)
      
      // Square batch delete (max 200 par appel)
      try {
        const { result } = await squareClient.catalogApi.batchDeleteCatalogObjects({
          objectIds: idsArray,
        })
        
        squareResults.deleted = result.deletedObjectIds?.length || 0
        squareResults.notFound = idsArray.length - squareResults.deleted
      } catch (squareError: any) {
        console.error('Square batch delete error:', squareError?.message)
        // On continue avec Firestore même si Square échoue
        squareResults.failed = idsArray.length
      }
    }

    // --- Firestore : batch write ---
    const batch = adminDb.batch()

    for (const { ref, data } of validProducts) {
      if (justif === 'produit_recupere') {
        batch.update(ref, {
          statut: 'retour',
          dateRetour: FieldValue.serverTimestamp(),
          derniereAction: 'retour',
        })
      } else {
        batch.delete(ref)
      }
    }

    await batch.commit()

    return NextResponse.json({
      success: true,
      action: justif === 'produit_recupere' ? 'retour' : 'delete',
      count: validProducts.length,
      square: squareResults,
    })

  } catch (e: any) {
    console.error('❌ [API DELETE PRODUITS BATCH]', e?.message || e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}