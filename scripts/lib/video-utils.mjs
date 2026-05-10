// Lib utilitaire pour télécharger / ré-encoder / uploader des vidéos.
// Encode en H.264 baseline + faststart + max 1080p → autoplay iOS Safari OK.
//
// Usage :
//   import { addReelToChineuse, addReelToIconique } from './lib/video-utils.mjs'
//   await addReelToChineuse('brujas', 'https://www.instagram.com/reel/DYFAQuDIg9u/')
//
// Ou bas niveau :
//   import { downloadReel, reencodeForWeb, uploadBunny } from './lib/video-utils.mjs'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { execSync } from 'child_process'
import https from 'https'

const BUNNY_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'
const TMP = '/tmp/video-utils'
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true })

let _db = null
function getDb() {
  if (_db) return _db
  const sa = JSON.parse(readFileSync(new URL('../firebase-service-account.json', import.meta.url), 'utf8'))
  if (!getApps().length) initializeApp({ credential: cert(sa) })
  _db = getFirestore()
  return _db
}

/** Télécharge un reel/post Instagram via yt-dlp. Retourne le chemin local du .mp4. */
export function downloadReel(url, name) {
  const dest = `${TMP}/${name}.mp4`
  execSync(`yt-dlp -o "${dest.replace('.mp4', '.%(ext)s')}" -f "bestvideo[ext=mp4]+bestaudio/best" --merge-output-format mp4 "${url}" 2>&1 | tail -1`, { stdio: 'pipe' })
  return dest
}

/** Re-encode un mp4 local en H.264 baseline + faststart + max 1080p. */
export function reencodeForWeb(input, output) {
  execSync(`ffmpeg -y -i "${input}" -c:v libx264 -profile:v baseline -level 3.1 -preset medium -crf 23 -vf "scale='min(1080,iw)':-2" -c:a aac -b:a 128k -movflags +faststart "${output}" 2>/dev/null`, { stdio: 'pipe' })
  return output
}

/** Upload un fichier local sur Bunny CDN à un chemin donné. Retourne l'URL publique. */
export async function uploadBunny(localPath, bunnyPath, contentType = 'video/mp4') {
  const buf = readFileSync(localPath)
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'storage.bunnycdn.com', port: 443,
      path: `/nouvellerive/${bunnyPath}`, method: 'PUT',
      headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': contentType, 'Content-Length': buf.length },
    }, (res) => res.statusCode === 201 ? resolve() : reject(new Error('Upload: ' + res.statusCode)))
    req.on('error', reject); req.write(buf); req.end()
  })
  return `https://nouvellerive.b-cdn.net/${bunnyPath}`
}

/** Pipeline complet : Insta URL → fichier mp4 web-ready uploadé sur Bunny. Retourne l'URL Bunny. */
export async function instaToBunny(instaUrl) {
  const m = instaUrl.match(/\/(reel|p|tv)\/([^/?]+)/i)
  if (!m) throw new Error('URL Instagram invalide : ' + instaUrl)
  const id = m[2]
  const raw = downloadReel(instaUrl, id)
  const fs = `${TMP}/${id}-fs.mp4`
  reencodeForWeb(raw, fs)
  const bunnyPath = `videos/${id}-fs-${Date.now()}.mp4`
  const url = await uploadBunny(fs, bunnyPath)
  try { unlinkSync(raw); unlinkSync(fs) } catch {}
  return url
}

/** Ajoute un reel Insta à la fin de chineuse/<id>.videos. */
export async function addReelToChineuse(chineuseId, instaUrl) {
  const url = await instaToBunny(instaUrl)
  const ref = getDb().collection('chineuse').doc(chineuseId)
  const cur = (await ref.get()).data()?.videos || []
  if (cur.includes(url)) return url
  await ref.update({ videos: [...cur, url] })
  return url
}

/** Ajoute un reel Insta à la fin de iconiques/<id>.videos. */
export async function addReelToIconique(iconiqueId, instaUrl) {
  const url = await instaToBunny(instaUrl)
  const ref = getDb().collection('iconiques').doc(iconiqueId)
  const cur = (await ref.get()).data()?.videos || []
  if (cur.includes(url)) return url
  await ref.update({ videos: [...cur, url] })
  return url
}
