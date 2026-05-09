// Récupère toutes les URLs Instagram dans iconiques + chineuse,
// les télécharge via yt-dlp, upload sur Bunny CDN /videos/{id}.mp4,
// puis remplace les URLs IG par les URLs Bunny dans Firestore.
//
// Pré-requis : yt-dlp installé (brew install yt-dlp).
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const BUNNY_STORAGE_ZONE = 'nouvellerive'
const BUNNY_API_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'
const BUNNY_CDN_URL = 'https://nouvellerive.b-cdn.net'
const TMP_DIR = '/tmp/nr-videos'

if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })

// "https://www.instagram.com/reel/XYZ/?…" → "XYZ"
function instagramId(url) {
  const m = url.match(/instagram\.com\/(?:reel|p|tv)\/([^/?]+)/i)
  return m ? m[1] : null
}

function isInstagramUrl(url) {
  return typeof url === 'string' && url.includes('instagram.com')
}

function uploadToBunny(filePath, remotePath) {
  return new Promise((resolveP, rejectP) => {
    const buffer = readFileSync(filePath)
    const options = {
      hostname: 'storage.bunnycdn.com',
      path: '/' + BUNNY_STORAGE_ZONE + '/' + remotePath,
      method: 'PUT',
      headers: {
        AccessKey: BUNNY_API_KEY,
        'Content-Type': 'video/mp4',
        'Content-Length': buffer.length,
      },
    }
    const req = https.request(options, (res) => {
      if (res.statusCode === 201) resolveP()
      else rejectP(new Error('Bunny upload HTTP ' + res.statusCode))
    })
    req.on('error', rejectP)
    req.write(buffer)
    req.end()
  })
}

async function downloadOne(igUrl) {
  const id = instagramId(igUrl)
  if (!id) throw new Error('URL IG invalide : ' + igUrl)
  const localPath = `${TMP_DIR}/${id}.mp4`
  if (existsSync(localPath) && statSync(localPath).size > 10000) {
    return { id, localPath, cached: true }
  }
  // yt-dlp avec format mp4 forcé
  execSync(
    `yt-dlp -q --no-warnings -f 'best[ext=mp4]/best' -o '${localPath}' '${igUrl}'`,
    { stdio: 'pipe' }
  )
  return { id, localPath, cached: false }
}

// 1) Collecte toutes les URLs IG depuis iconiques + chineuse
const targets = [] // { coll, docId, fieldPath: 'videos', urls: [...] }

const iconSnap = await db.collection('iconiques').get()
iconSnap.forEach((d) => {
  const v = d.data().videos
  if (Array.isArray(v) && v.some(isInstagramUrl)) {
    targets.push({ coll: 'iconiques', docId: d.id, urls: v.slice() })
  }
})

const chSnap = await db.collection('chineuse').get()
chSnap.forEach((d) => {
  const v = d.data().videos
  if (Array.isArray(v) && v.some(isInstagramUrl)) {
    targets.push({ coll: 'chineuse', docId: d.id, urls: v.slice() })
  }
})

console.log(`Documents à traiter : ${targets.length}`)
const allUrls = new Set()
targets.forEach((t) => t.urls.forEach((u) => isInstagramUrl(u) && allUrls.add(u)))
console.log(`URLs IG uniques : ${allUrls.size}`)

// 2) Download + upload chaque URL unique
const urlMap = {} // igUrl → bunnyUrl
let i = 0
for (const igUrl of allUrls) {
  i++
  try {
    process.stdout.write(`[${i}/${allUrls.size}] ${igUrl} `)
    const { id, localPath, cached } = await downloadOne(igUrl)
    process.stdout.write(cached ? '(cache) ' : '↓ ')
    const remotePath = `videos/${id}.mp4`
    await uploadToBunny(localPath, remotePath)
    const bunnyUrl = `${BUNNY_CDN_URL}/${remotePath}`
    urlMap[igUrl] = bunnyUrl
    console.log('✓ ' + bunnyUrl)
  } catch (e) {
    console.log('✗ ' + e.message)
    urlMap[igUrl] = null
  }
}

// 3) Met à jour Firestore : remplace les URLs IG par les URLs Bunny (échecs gardés)
console.log('\n─── Mise à jour Firestore ───')
let updated = 0
for (const t of targets) {
  const newUrls = t.urls.map((u) => (isInstagramUrl(u) && urlMap[u] ? urlMap[u] : u))
  await db.collection(t.coll).doc(t.docId).update({ videos: newUrls })
  updated++
  console.log(`  ✓ ${t.coll}/${t.docId}`)
}
console.log(`\nDocs mis à jour : ${updated}`)
