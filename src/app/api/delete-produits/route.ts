// app/api/delete-produits/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { archiveOrDeleteByVariation } from '@/lib/square/archiveOrDeleteByVariation'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

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

    const adminDb = getFirestore()

    // --- Récup produit ---
    const ref = adminDb.collection('produits').doc(String(productId))
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Produit introuvable' }, { status: 404 })
    }
    const data = snap.data() as any

    // --- Sécurité : Admin OU propriétaire ---
    const userEmail = String(decoded?.email || '')
    const userUid = String(decoded?.uid || '')
    
    // ✅ L'admin peut tout supprimer
    const isAdmin = userEmail === ADMIN_EMAIL
    
    // Vérification propriétaire pour les non-admins
    const chineur = String(data?.chineur || '')
    const chineurUid = String(data?.chineurUid || '')
    const ownerUid = String(data?.ownerUid || '')
    const ownerEmail = String(data?.ownerEmail || '')

    const isOwner =
      (chineur && (chineur === userEmail || chineur === userUid)) ||
      (chineurUid && chineurUid === userUid) ||
      (ownerUid && ownerUid === userUid) ||
      (ownerEmail && ownerEmail === userEmail)

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success: false, error: 'Interdit' }, { status: 403 })
    }

    // ========================================================================
    // SQUARE : supprimer variation OU fallback archive (via helper)
    // ========================================================================
    const squareIds = Array.from(
      new Set([data?.variationId, data?.catalogObjectId, data?.itemId].filter(Boolean).map(String))
    )

    let squareAttempted = false
    const deletedIds: string[] = []
    const notFoundIds: string[] = []
    const failedIds: { id: string; error: string }[] = []

    if (squareIds.length > 0) {
      squareAttempted = true

      for (const id of squareIds) {
        try {
          const res = await archiveOrDeleteByVariation(id)
          if (res.ok) {
            deletedIds.push(id)
          } else if (res.error?.match(/NOT_FOUND|OBJECT_NOT_FOUND/i)) {
            notFoundIds.push(id)
          } else {
            failedIds.push({ id, error: res.error || 'Unknown error' })
          }
        } catch (sqErr: any) {
          // Erreur Square non bloquante - on continue avec Firestore
          failedIds.push({ id, error: sqErr?.message || 'Square error' })
        }
      }

      // ✅ On ne bloque plus si Square échoue - on continue avec Firestore
      // L'important c'est que le produit soit marqué/supprimé dans Firestore
    }

    // ================================
    // FIRESTORE : retour ou suppression
    // ================================
    if (justif === 'produit_recupere') {
      await ref.set(
        {
          statut: 'retour',
          dateRetour: FieldValue.serverTimestamp(),
          derniereAction: 'retour',
          squareDeletedIds: deletedIds,
        },
        { merge: true }
      )
      return NextResponse.json({
        success: true,
        action: 'retour',
        squareAttempted,
        deletedIds,
        notFoundIds,
        failedIds,
      })
    } else {
      await ref.delete()
      return NextResponse.json({
        success: true,
        action: 'delete',
        squareAttempted,
        deletedIds,
        notFoundIds,
        failedIds,
      })
    }
  } catch (e: any) {
    console.error('❌ [API DELETE PRODUITS]', e?.message || e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}