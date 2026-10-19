import { adminDb } from '@/lib/firebaseAdmin'

// Publication TikTok via Content Posting API.
// Deux modes, choisis automatiquement selon le scope porté par le token stocké :
//  - video.publish présent (app auditée « Direct Post ») → publication DIRECTE
//    sur le compte connecté, rien à faire dans l'app TikTok.
//  - sinon → dépôt en BROUILLON (video.upload), la créatrice tape « Publier ».
// Envoi vidéo en FILE_UPLOAD (on pousse le fichier) → pas besoin de vérifier de domaine.

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET
const DOC = () => adminDb.collection('reseauxConfig').doc('tiktok')

// Renvoie un access token valide (rafraîchit si expiré).
export async function getTikTokToken(): Promise<string> {
  return getAccessToken()
}
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

// Le token autorise-t-il la publication directe ? (scope accordé à la connexion)
export async function canDirectPost(): Promise<boolean> {
  const snap = await DOC().get()
  const scope = String((snap.data() as any)?.scope || '')
  return scope.split(',').map((s) => s.trim()).includes('video.publish')
}

// Infos du compte connecté : obligatoire avant un Direct Post (TikTok impose
// d'afficher/respecter les options de confidentialité et de commentaires).
export async function getTikTokCreatorInfo(token?: string): Promise<any> {
  const t = token || (await getAccessToken())
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json; charset=UTF-8' },
  })
  const data = await res.json()
  if (!data?.data) throw new Error(`TikTok creator_info échoué: ${JSON.stringify(data)}`)
  return data.data
}

// Public si le compte le permet, sinon la 1re option proposée (sandbox = SELF_ONLY).
function pickPrivacy(info: any): string {
  const opts: string[] = Array.isArray(info?.privacy_level_options) ? info.privacy_level_options : []
  return opts.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : (opts[0] || 'SELF_ONLY')
}

// Statut de publication (non bloquant).
async function fetchStatus(token: string, publishId: string): Promise<string> {
  try {
    await new Promise((r) => setTimeout(r, 3000))
    const st = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ publish_id: publishId }),
    }).then((r) => r.json())
    return st?.data?.status || JSON.stringify(st?.error || st)
  } catch {
    return ''
  }
}

// Envoie une vidéo sur le TikTok connecté : publication directe si le scope
// video.publish est accordé, sinon brouillon dans l'inbox de la créatrice.
export async function publishTikTokVideo(videoUrl: string, caption = ''): Promise<{ publishId: string; status: string; mode: 'direct' | 'draft' }> {
  const token = await getAccessToken()
  const direct = await canDirectPost()

  // 1) Récupère les octets de la vidéo (Firebase/Bunny)
  const vid = await fetch(videoUrl)
  if (!vid.ok) throw new Error(`vidéo inaccessible (${vid.status})`)
  const buf = Buffer.from(await vid.arrayBuffer())
  const size = buf.length
  if (size > 64 * 1024 * 1024) throw new Error('Vidéo > 64 Mo : découpage non géré pour l’instant.')

  const source_info = { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 }

  // 2) Init de l'upload (un seul chunk)
  let initUrl = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/'
  let body: any = { source_info }
  if (direct) {
    const info = await getTikTokCreatorInfo(token)
    initUrl = 'https://open.tiktokapis.com/v2/post/publish/video/init/'
    body = {
      post_info: {
        title: (caption || '').slice(0, 2200),
        privacy_level: pickPrivacy(info),
        disable_comment: !!info.comment_disabled,
        disable_duet: !!info.duet_disabled,
        disable_stitch: !!info.stitch_disabled,
      },
      source_info,
    }
  }
  const initRes = await fetch(initUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body),
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

  return { publishId, status: await fetchStatus(token, publishId), mode: direct ? 'direct' : 'draft' }
}

// Compat : ancien nom (brouillon) → même fonction, le mode dépend du scope.
export const publishTikTokDraft = publishTikTokVideo

// Poste un carrousel PHOTO (diaporama) sur TikTok : DIRECT_POST si le scope
// video.publish est accordé, sinon MEDIA_UPLOAD (brouillon à finaliser).
// Les images doivent être servies depuis le domaine vérifié → proxy nouvellerive.eu.
export async function publishTikTokPhotos(imageUrls: string[], caption: string): Promise<{ publishId: string; status: string; mode: 'direct' | 'draft' }> {
  const token = await getAccessToken()
  if (!imageUrls.length) throw new Error('Aucune image')
  const direct = await canDirectPost()
  const proxied = imageUrls.map((u) => `https://www.nouvellerive.eu/api/reseaux/img?url=${encodeURIComponent(u)}`)

  const post_info: any = { title: (caption || '').slice(0, 90), description: caption || '' }
  if (direct) {
    const info = await getTikTokCreatorInfo(token)
    post_info.privacy_level = pickPrivacy(info)
    post_info.disable_comment = !!info.comment_disabled
    post_info.auto_add_music = true
  }

  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      media_type: 'PHOTO',
      post_mode: direct ? 'DIRECT_POST' : 'MEDIA_UPLOAD',
      post_info,
      source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: proxied },
    }),
  })
  const initData = await initRes.json()
  const publishId = initData?.data?.publish_id
  if (!publishId) throw new Error(`TikTok photo init échoué: ${JSON.stringify(initData)}`)

  return { publishId, status: await fetchStatus(token, publishId), mode: direct ? 'direct' : 'draft' }
}
