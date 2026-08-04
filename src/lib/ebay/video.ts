// lib/ebay/video.ts
// Upload d'une vidéo produit vers eBay (Media API) pour l'attacher à une annonce
// via product.videoIds (Inventory API).
//
// Flux eBay :
//   1. createVideo  → réserve la vidéo, renvoie l'id dans le header Location.
//                     La `size` (octets) déclarée doit correspondre EXACTEMENT au
//                     fichier uploadé, sinon l'upload échoue.
//   2. uploadVideo  → envoie le binaire .mp4 (MPEG-4 AVC).
//   3. On rend le videoId ; eBay finit le traitement en asynchrone, la vidéo
//      apparaît sur l'annonce une fois « LIVE » (pas besoin de poller pour attacher).
//
// Tout échec est non-bloquant : on renvoie null et l'annonce part sans vidéo.

import { getAccessToken, getEbayApiBase } from './clients'

// Cache mémoire (par run) : videoUrl -> ebayVideoId, évite de re-uploader.
const videoCache = new Map<string, string>()

export async function ensureEbayVideo(videoUrl: string): Promise<string | null> {
  if (!videoUrl) return null
  const cached = videoCache.get(videoUrl)
  if (cached) return cached

  try {
    const base = getEbayApiBase()
    const token = await getAccessToken()

    // 1. Récupère le mp4 (Cloudinary) pour connaître sa taille exacte.
    const vidRes = await fetch(videoUrl)
    if (!vidRes.ok) {
      console.warn(`⚠️ eBay video: source injoignable (${vidRes.status}) ${videoUrl}`)
      return null
    }
    const buf = Buffer.from(await vidRes.arrayBuffer())
    const size = buf.length
    if (size === 0) return null

    // 2. createVideo → id dans le header Location.
    const createRes = await fetch(`${base}/commerce/media/v1/video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Nouvelle Rive',
        classification: ['ITEM_VIDEO'],
        size,
      }),
    })
    if (createRes.status !== 201 && !createRes.ok) {
      console.warn(`⚠️ eBay createVideo échec ${createRes.status}: ${(await createRes.text()).slice(0, 200)}`)
      return null
    }
    const location = createRes.headers.get('location') || ''
    const videoId = location.split('/').filter(Boolean).pop() || ''
    if (!videoId) {
      console.warn('⚠️ eBay createVideo : pas de videoId dans Location')
      return null
    }

    // 3. uploadVideo — le binaire, taille identique à `size`.
    const upRes = await fetch(`${base}/commerce/media/v1/video/${videoId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: buf,
    })
    if (!upRes.ok) {
      console.warn(`⚠️ eBay uploadVideo échec ${upRes.status}: ${(await upRes.text()).slice(0, 200)}`)
      return null
    }

    console.log(`🎬 eBay vidéo uploadée: ${videoId}`)
    videoCache.set(videoUrl, videoId)
    return videoId
  } catch (e: any) {
    console.warn('⚠️ ensureEbayVideo failed:', e?.message || e)
    return null
  }
}
