// app/api/admin/refresh-produit/route.ts
// Après modification d'une fiche produit en admin, le doc Firestore est à jour
// mais le cache blob `produits-all` (TTL 6h) sert encore l'ancienne version —
// au rechargement, la liste admin réaffichait l'ancienne photo.
//
// Cette route relit UNIQUEMENT le doc modifié (1 read) et le remplace dans le
// blob. Pas de rescan de la collection.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { patchBlobCache } from '@/lib/blobCache'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

type Item = { id: string; raw: any }

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
    if (!token) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(token)
    } catch {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    }
    if (decoded.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    }

    const { productId } = await req.json()
    if (!productId) return NextResponse.json({ success: false, error: 'productId requis' }, { status: 400 })

    const snap = await adminDb.collection('produits').doc(productId).get()

    const patched = await patchBlobCache<Item[]>('produits-all', (items) => {
      if (!snap.exists) return items.filter(it => it.id !== productId)
      const fresh: Item = { id: productId, raw: snap.data() }
      // Remplacement en place : on ne change pas l'ordre du blob.
      let found = false
      const next = items.map(it => {
        if (it.id !== productId) return it
        found = true
        return fresh
      })
      return found ? next : [...next, fresh]
    })

    return NextResponse.json({ success: true, patched })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
