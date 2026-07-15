// lib/blobCache.ts
// Cache 2-niveaux pour de gros datasets Firestore :
//  L1 : mémoire module-scoped (par worker Vercel)
//  L2 : blob JSON gzippé dans Firebase Storage (partagé entre TOUS les workers)
//
// Idée : chaque worker download le blob 1× (~50-500 KB gzippé au lieu de scan
// 5000+ docs Firestore = ~5000 reads). Le blob est régénéré tous les X heures
// par le premier worker qui trouve un blob périmé (fetch Firestore + upload).
//
// Coût typique par worker sur 24h :
//   avant : 5-10 fetches × 5000 reads = 25k-50k reads/jour
//   après : 5-10 downloads × 1 read (metadata) + refresh rare = qq reads/jour

import { adminStorage } from '@/lib/firebaseAdmin'
import { gzipSync, gunzipSync } from 'zlib'

type CachedInMemory<T> = { data: T; at: number }

const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET

/**
 * Retourne les données `T` via cache 2-niveaux.
 *
 * @param key      clé unique (ex: 'produits-all', 'chineuses-lite')
 * @param ttlMs    durée de validité du blob (ex: 6h)
 * @param memory   ref d'un objet module-scoped { current: CachedInMemory<T> | null }
 * @param inflight ref d'un objet module-scoped { current: Promise<T> | null } (anti-thundering-herd)
 * @param fetcher  fonction async qui refait le scan Firestore (appelée uniquement si blob périmé)
 */
export async function getBlobCached<T>(
  key: string,
  ttlMs: number,
  memory: { current: CachedInMemory<T> | null },
  inflight: { current: Promise<T> | null },
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now()

  // L1 : mémoire process — 0 IO.
  if (memory.current && now - memory.current.at < ttlMs) {
    return memory.current.data
  }
  if (inflight.current) return inflight.current

  inflight.current = (async () => {
    try {
      // L2 : blob Firebase Storage — 1 download compressé (~50-500 KB) OU 1 refresh Firestore.
      if (BUCKET_NAME) {
        try {
          const file = adminStorage.bucket().file(`_cache/${key}.json.gz`)
          const [exists] = await file.exists()
          if (exists) {
            const [meta] = await file.getMetadata()
            const updatedAt = meta.updated ? new Date(meta.updated as string).getTime() : 0
            if (updatedAt && now - updatedAt < ttlMs) {
              const [buf] = await file.download()
              const json = gunzipSync(buf).toString('utf8')
              const data = JSON.parse(json) as T
              memory.current = { data, at: Date.now() }
              return data
            }
          }
        } catch {
          // Blob absent ou erreur download — on refait le scan Firestore.
        }
      }

      // Fallback / refresh : scan Firestore + upload nouveau blob.
      const fresh = await fetcher()
      memory.current = { data: fresh, at: Date.now() }
      if (BUCKET_NAME) {
        // Upload fire-and-forget (ne bloque pas la réponse).
        try {
          const file = adminStorage.bucket().file(`_cache/${key}.json.gz`)
          const buf = gzipSync(Buffer.from(JSON.stringify(fresh), 'utf8'))
          file
            .save(buf, {
              contentType: 'application/json',
              metadata: { contentEncoding: 'gzip', cacheControl: `public, max-age=${Math.floor(ttlMs / 1000)}` },
              resumable: false,
            })
            .catch(() => {})
        } catch {
          /* ignore */
        }
      }
      return fresh
    } finally {
      inflight.current = null
    }
  })()

  return inflight.current
}
