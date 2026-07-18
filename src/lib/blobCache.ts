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

// Selon la version du SDK Storage, `file.download()` décompresse déjà le gzip
// (contentEncoding: gzip). Sans ce fallback, le gunzip jette, le catch se
// rabat sur un scan complet de la collection → des milliers de reads Firestore.
function decodeBlob(buf: Buffer): string {
  try {
    return gunzipSync(buf).toString('utf8')
  } catch {
    return buf.toString('utf8')
  }
}

/**
 * Retourne les données `T` via cache 2-niveaux.
 *
 * @param key      clé unique (ex: 'produits-all', 'chineuses-lite')
 * @param ttlMs    durée de validité du blob (ex: 6h)
 * @param memory   ref d'un objet module-scoped { current: CachedInMemory<T> | null }
 * @param inflight ref d'un objet module-scoped { current: Promise<T> | null } (anti-thundering-herd)
 * @param fetcher  fonction async qui refait le scan Firestore (appelée uniquement si blob périmé)
 * @param memTtlMs durée de validité du cache L1 (défaut : ttlMs). La mettre plus
 *                 courte permet à un worker de re-télécharger un blob patché
 *                 (ex: après modification d'une fiche) sans toucher Firestore.
 */
export async function getBlobCached<T>(
  key: string,
  ttlMs: number,
  memory: { current: CachedInMemory<T> | null },
  inflight: { current: Promise<T> | null },
  fetcher: () => Promise<T>,
  memTtlMs: number = ttlMs,
): Promise<T> {
  const now = Date.now()

  // L1 : mémoire process — 0 IO.
  if (memory.current && now - memory.current.at < memTtlMs) {
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
              const data = JSON.parse(decodeBlob(buf)) as T
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

/**
 * Patche le blob L2 en place, sans rescanner Firestore.
 *
 * Sert après la modification d'UNE fiche : on télécharge le blob, on remplace
 * l'entrée concernée, on ré-uploade. Coût = 1 download + 1 upload, 0 read
 * Firestore — au lieu de supprimer le blob (= rescan de 5000+ docs).
 *
 * Ne fait rien si le blob n'existe pas encore (il sera généré au prochain accès).
 */
export async function patchBlobCache<T>(
  key: string,
  patcher: (data: T) => T,
): Promise<boolean> {
  if (!BUCKET_NAME) return false
  try {
    const file = adminStorage.bucket().file(`_cache/${key}.json.gz`)
    const [exists] = await file.exists()
    if (!exists) return false

    const [meta] = await file.getMetadata()
    const [buf] = await file.download()
    const data = JSON.parse(decodeBlob(buf)) as T
    const next = patcher(data)

    await file.save(gzipSync(Buffer.from(JSON.stringify(next), 'utf8')), {
      contentType: 'application/json',
      // On conserve le cacheControl d'origine pour ne pas changer le TTL du blob.
      metadata: { contentEncoding: 'gzip', cacheControl: meta.cacheControl as string | undefined },
      resumable: false,
    })
    return true
  } catch {
    return false
  }
}
