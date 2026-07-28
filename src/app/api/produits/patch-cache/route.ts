// app/api/produits/patch-cache/route.ts
// Quand une chineuse crée une pièce depuis l'app (setDoc client sur `produits`),
// le doc est bien écrit mais le cache blob `produits-all` (TTL 6h) continue de
// servir l'ancienne liste — la pièce n'apparaît donc pas sur /admin/nos-produits
// avant expiration du blob (jusqu'à 6h).
//
// Cette route relit UNIQUEMENT le doc créé (1 read) et l'insère dans le blob,
// sans rescan de la collection. Accessible à la chineuse propriétaire de la
// pièce (elle ne peut patcher que ses propres pièces).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { patchBlobCache } from '@/lib/blobCache'

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

    const body = await req.json()
    const ids: string[] = Array.isArray(body?.productIds)
      ? body.productIds.filter(Boolean)
      : body?.productId
        ? [body.productId]
        : []
    if (!ids.length) return NextResponse.json({ success: false, error: 'productId(s) requis' }, { status: 400 })

    // Relit les docs créés (1 read chacun) et ne garde que ceux appartenant à
    // la chineuse — elle ne peut patcher que ses propres pièces.
    const snaps = await Promise.all(ids.map(id => adminDb.collection('produits').doc(id).get()))
    const fresh: Item[] = []
    for (const snap of snaps) {
      if (!snap.exists) continue
      const data = snap.data() as any
      const owns = data?.chineurUid === decoded.uid || data?.chineur === decoded.email
      if (!owns) continue
      fresh.push({ id: snap.id, raw: data })
    }
    if (!fresh.length) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })

    // Un seul download + upload du blob pour tout le lot.
    const byId = new Map(fresh.map(f => [f.id, f]))
    const patched = await patchBlobCache<Item[]>('produits-all', (items) => {
      const seen = new Set<string>()
      const next = items.map(it => {
        const f = byId.get(it.id)
        if (!f) return it
        seen.add(it.id)
        return f
      })
      for (const f of fresh) if (!seen.has(f.id)) next.push(f)
      return next
    })

    return NextResponse.json({ success: true, patched, count: fresh.length })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
