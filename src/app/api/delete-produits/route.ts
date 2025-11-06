// app/api/delete-produits/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { archiveOrDeleteByVariation } from '@/lib/square/archiveOrDeleteByVariation'


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
    const decoded = await adminAuth.verifyIdToken(token)

    const adminDb = getFirestore()

    // --- Récup produit ---
    const ref = adminDb.collection('produits').doc(String(productId))
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Produit introuvable' }, { status: 404 })
    }
    const data = snap.data() as any

    // --- Sécurité propriétaire (tolérante) ---
    const chineur = String(data?.chineur || '')
    const ownerUid = String(data?.ownerUid || '')
    const ownerEmail = String(data?.ownerEmail || '')
    const userEmail = String(decoded?.email || '')
    const userUid = String(decoded?.uid || '')

    const isOwner =
     (chineur && (chineur === userEmail || chineur === userUid)) ||
     (ownerUid && ownerUid === userUid) ||
     (ownerEmail && ownerEmail === userEmail)

    if (!isOwner) {
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
        const res = await archiveOrDeleteByVariation(id)
        if (res.ok) {
          deletedIds.push(id)
        } else if (res.error?.match(/NOT_FOUND|OBJECT_NOT_FOUND/i)) {
          notFoundIds.push(id)
        } else {
          failedIds.push({ id, error: res.error || 'Unknown error' })
        }
      }

      // Si aucune suppression/archivage n'a fonctionné → échec
      const okCount = deletedIds.length + notFoundIds.length
      if (okCount === 0 && failedIds.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Suppression Square échouée',
            details: { failedIds },
          },
          { status: 502 }
        )
      }
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
