import { adminDb } from '@/lib/firebaseAdmin'

// Publication TikTok via Content Posting API.
// Mode actuel : video.upload → dépôt en BROUILLON dans l'app TikTok (la créatrice
// tape « Publier »). video.publish (Direct Post auto) nécessite l'audit TikTok.
// Envoi en FILE_UPLOAD (on pousse le fichier) → pas besoin de vérifier de domaine.

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET
const DOC = () => adminDb.collection('reseauxConfig').doc('tiktok')

// Renvoie un access token valide (rafraîchit si expiré).
async function getAccessToken(): Promise<string> {
  const snap = await DOC().get()
  if (!snap.exists) throw new Error('TikTok non connecté (aucun token). Clique « Connecter TikTok ».')
  const t = snap.data() as any
  // marge de 2 min
  if (t.accessToken && t.expiresAt && t.expiresAt - 120000 > Date.now()) return t.accessToken

  if (!t.refreshToken) throw new Error('TikTok : token expiré et pas de refresh. Reconnecte TikTok.')
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: CLIENT_KEY || '',
      client_secret: CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: t.refreshToken,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`TikTok refresh échoué: ${JSON.stringify(data)}`)
  await DOC().set({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || t.refreshToken,
    expiresAt: Date.now() + (data.expires_in || 0) * 1000,
    updatedAt: Date.now(),
  }, { merge: true })
  return data.access_token
}

// Dépose une vidéo en brouillon dans le TikTok connecté. Renvoie le publish_id.
export async function publishTikTokDraft(videoUrl: string): Promise<string> {
  const token = await getAccessToken()

  // 1) Récupère les octets de la vidéo (Firebase/Bunny)
  const vid = await fetch(videoUrl)
  if (!vid.ok) throw new Error(`vidéo inaccessible (${vid.status})`)
  const buf = Buffer.from(await vid.arrayBuffer())
  const size = buf.length
  if (size > 64 * 1024 * 1024) throw new Error('Vidéo > 64 Mo : découpage non géré pour l’instant.')

  // 2) Init de l'upload inbox (FILE_UPLOAD, un seul chunk)
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 },
    }),
  })
  const initData = await initRes.json()
  const uploadUrl = initData?.data?.upload_url
  const publishId = initData?.data?.publish_id
  if (!uploadUrl || !publishId) throw new Error(`TikTok init échoué: ${JSON.stringify(initData)}`)

  // 3) Upload des octets
  const up = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${size - 1}/${size}`,
    },
    body: buf,
  })
  if (!up.ok) throw new Error(`TikTok upload échoué (${up.status}): ${await up.text().catch(() => '')}`)

  return publishId
}
