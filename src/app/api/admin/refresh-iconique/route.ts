// app/api/admin/refresh-iconique/route.ts
// Après modification d'un iconique en admin, le doc Firestore est à jour mais le
// blob `iconiques` (TTL 6h) sert encore l'ancienne version — un recadrage photo
// ou un texte modifié mettait jusqu'à 6h à apparaître sur /les-iconiques.
//
// Cette route relit UNIQUEMENT le doc modifié (1 read) et le remplace dans le
// blob. Pas de rescan de la collection. Même principe que refresh-produit.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { patchBlobCache } from '@/lib/blobCache'
import type { IconiqueDoc } from '@/lib/getIconiquesCached'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

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

    const { iconiqueId } = await req.json()
    if (!iconiqueId) return NextResponse.json({ success: false, error: 'iconiqueId requis' }, { status: 400 })

    const snap = await adminDb.collection('iconiques').doc(iconiqueId).get()

    const patched = await patchBlobCache<IconiqueDoc[]>('iconiques', (items) => {
      if (!snap.exists) return items.filter(it => it.id !== iconiqueId)
      const fresh = { id: iconiqueId, ...(snap.data() as any) } as IconiqueDoc
      // Remplacement en place : on ne change pas l'ordre du blob.
      let found = false
      const next = items.map(it => {
        if (it.id !== iconiqueId) return it
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
