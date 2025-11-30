// app/api/sync-ventes/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'
import { syncVentesDepuisSquare } from '@/lib/syncSquareToFirestore'
import { archiveOrDeleteByVariation } from '@/lib/square/archiveOrDeleteByVariation'
import { removeFromAllChannels } from '@/lib/syncRemoveFromAllChannels'

function isNonEmptyString(x: any): x is string {
  return typeof x === 'string' && x.trim().length > 0
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    let decoded: any = null
    if (token) {
      try {
        decoded = await adminAuth.verifyIdToken(token)
      } catch {}
    }

    const { uid: uidFromBody, startDateStr, endDateStr, all } = await req.json().catch(() => ({}))

    // MODE GLOBAL : sync toutes les chineuses
    if (all === true) {
      const chineusesSnap = await adminDb.collection('chineuse').get()
      
      if (chineusesSnap.empty) {
        return NextResponse.json(
          { success: false, error: 'Aucune chineuse trouvée' },
          { status: 404 }
        )
      }

      let totalSync = 0
      let totalNonAttribuees = 0
      let totalNotFound = 0

      for (const doc of chineusesSnap.docs) {
        const chineuseData = doc.data()
        const uid = doc.id
        const nom = chineuseData.nom || chineuseData.trigramme || uid

        try {
          const result = await syncVentesDepuisSquare(uid, nom, startDateStr, endDateStr)
          totalSync += result.nbSync || 0
          totalNonAttribuees += result.nbNonAttribuees || 0
          totalNotFound += result.nbNotFound || 0
        } catch (err: any) {
          console.error(`❌ Sync ${nom}:`, err.message)
        }
      }

      return NextResponse.json({
        success: true,
        message: `${totalSync} ventes sync, ${totalNonAttribuees} à attribuer`,
      })
    }

    // MODE SINGLE : sync une chineuse
    const uid: string | null =
      (decoded?.uid as string | undefined) ??
      (isNonEmptyString(uidFromBody) ? uidFromBody : null)

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'UID manquant' },
        { status: 400 }
      )
    }

    const chineuseSnap = await adminDb.collection('chineuse').doc(uid).get()
    if (!chineuseSnap.exists) {
      return NextResponse.json(
        { success: false, error: `Chineuse non trouvée: ${uid}` },
        { status: 404 }
      )
    }
    const chineurNom = (chineuseSnap.data() as any)?.nom
    if (!isNonEmptyString(chineurNom)) {
      return NextResponse.json(
        { success: false, error: 'Nom manquant' },
        { status: 400 }
      )
    }

    const result = await syncVentesDepuisSquare(uid, chineurNom, startDateStr, endDateStr)

    // Cleanup produits qty <= 0
    const prodQuery = adminDb.collection('produits').where('chineurUid', '==', uid)
    const snap1 = await prodQuery.get()
    let produitsDocs = snap1.docs

    let deletedCount = 0

    for (const d of produitsDocs) {
      const p: any = d.data()
      const qte = typeof p?.quantite === 'number' ? p.quantite : null
      if (qte !== null && qte <= 0) {
        const ids = [p?.variationId, p?.catalogObjectId, p?.itemId].filter(Boolean).map((x: any) => String(x))

        for (const id of ids) {
          try { await archiveOrDeleteByVariation(id) } catch {}
        }

        if (p.ebayListingId || p.ebayOfferId) {
          try {
            await removeFromAllChannels({
              id: d.id,
              ebayListingId: p.ebayListingId,
              ebayOfferId: p.ebayOfferId,
              sku: p.sku,
            }, 'square')
          } catch {}
        }

        await d.ref.delete()
        deletedCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: result?.message ?? 'Sync OK',
      cleanup: { deletedCount },
    })
  } catch (err: any) {
    console.error('[API SYNC VENTES]', err)
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    )
  }
}