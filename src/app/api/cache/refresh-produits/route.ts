// app/api/cache/refresh-produits/route.ts
// Rafraîchit le cache produits après un restock, pour que les pièces reçues
// (et leurs photos refaites) soient live IMMÉDIATEMENT sur le site + l'app,
// sans attendre le TTL edge (6h) ni un redéploiement manuel.
//
// Fait deux choses :
//   1. Patch le blob `produits-all` avec les pièces reçues (relit N docs =
//      quelques reads, PAS de rescan de la collection → esprit « payer zéro »).
//   2. revalidatePath sur les routes/pages produits publiques → purge de la
//      réponse edge cachée (même mécanisme que /api/site-config).
//
// Non destructif : appelable par le flux vendeuse (qui n'est pas toujours
// connecté Firebase, cf. delete-produits `valider_destock`). Le nombre d'ids
// est borné pour éviter tout abus.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminDb } from '@/lib/firebaseAdmin'
import { patchBlobCache } from '@/lib/blobCache'
import { forceRefreshProduitsBlob } from '@/lib/getAllProduitsCached'

type Item = { id: string; raw: any }

const MAX_IDS = 200

// Listes/pages publiques qui servent les produits (réponses cachées à l'edge).
const STATIC_PATHS = [
  '/api/boutique-produits',
  '/api/page-produits',
  '/api/creatrice-page',
  '/boutique',
  '/coups-de-coeur',
  '/new-in',
  '/femme',
  '/homme',
  '/accessoires',
  '/luxe',
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body?.productIds)
      ? body.productIds.filter(Boolean).slice(0, MAX_IDS)
      : []
    const chineuseId: string = String(body?.chineuseId || '').trim()
    const force = body?.force === true

    // 0. Mode « forçage » (bouton admin) : rescan complet Firestore + ré-upload
    //    du blob, puis purge edge. Coûteux mais explicitement déclenché.
    if (force) {
      const count = await forceRefreshProduitsBlob()
      for (const p of STATIC_PATHS) {
        try { revalidatePath(p) } catch { /* best effort */ }
      }
      return NextResponse.json({ success: true, forced: true, count, revalidated: STATIC_PATHS.length })
    }

    // 1. Patch du blob avec l'état frais des pièces reçues (upsert par id).
    //    Ne rescanne pas la collection : 1 read par pièce + 1 download/upload blob.
    let patched = false
    if (ids.length) {
      const snaps = await Promise.all(
        ids.map(id => adminDb.collection('produits').doc(id).get()),
      )
      const fresh: Item[] = []
      for (const snap of snaps) {
        if (!snap.exists) continue
        fresh.push({ id: snap.id, raw: snap.data() as any })
      }
      if (fresh.length) {
        const byId = new Map(fresh.map(f => [f.id, f]))
        patched = await patchBlobCache<Item[]>('produits-all', (items) => {
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
      }
    }

    // 2. Purge de l'edge : routes/pages produits + fiches des pièces + page chineuse.
    const paths = [...STATIC_PATHS]
    for (const id of ids) paths.push(`/boutique/${id}`)
    if (chineuseId) paths.push(`/nos-creatrices/${chineuseId}`)
    for (const p of paths) {
      try { revalidatePath(p) } catch { /* best effort */ }
    }

    return NextResponse.json({ success: true, patched, count: ids.length, revalidated: paths.length })
  } catch (e: any) {
    console.error('[API CACHE REFRESH-PRODUITS]', e)
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
