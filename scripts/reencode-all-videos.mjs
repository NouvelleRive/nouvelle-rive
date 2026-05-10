// Re-encode TOUTES les vidéos .mp4 des chineuses + iconiques avec :
// - codec H.264 baseline profile (compat iOS Safari max)
// - faststart (moov en tête → streaming progressif, autoplay rapide)
// - max 1080p (réduit la taille)
// - audio AAC 128k
// - CRF 23 (bonne qualité)
// Skip les URLs déjà ré-encodées (marker "-fs-" dans l'URL).
// Skip les URLs non-mp4 (instagram.com/reel/ etc).
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'fs'
import { execSync } from 'child_process'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const BUNNY_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'
const TMP = '/tmp/reencode-all'
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true })

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = []
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`Download ${url}: ${res.statusCode}`))
      res.on('data', (c) => file.push(c))
      res.on('end', () => { writeFileSync(dest, Buffer.concat(file)); resolve() })
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function upload(localPath, bunnyPath) {
  const buf = readFileSync(localPath)
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'storage.bunnycdn.com', port: 443,
      path: `/nouvellerive/${bunnyPath}`, method: 'PUT',
      headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'video/mp4', 'Content-Length': buf.length },
    }, (res) => res.statusCode === 201 ? resolve() : reject(new Error('Upload: ' + res.statusCode)))
    req.on('error', reject); req.write(buf); req.end()
  })
  return `https://nouvellerive.b-cdn.net/${bunnyPath}`
}

const cache = new Map() // oldUrl → newUrl (pour partager re-encodes entre docs)

async function reencodeOne(url) {
  if (cache.has(url)) return cache.get(url)
  if (!/\.mp4(\?|$)/i.test(url)) return url
  if (/-fs-\d/.test(url)) return url // déjà ré-encodé

  const id = url.split('/').pop().replace(/\.mp4.*$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const inFile = `${TMP}/${id}.mp4`
  const outFile = `${TMP}/${id}-fs.mp4`

  console.log(`  → ${id}`)
  try {
    await download(url, inFile)
    const inSize = (statSync(inFile).size / 1024 / 1024).toFixed(1)
    execSync(`ffmpeg -y -i "${inFile}" -c:v libx264 -profile:v baseline -level 3.1 -preset medium -crf 23 -vf "scale='min(1080,iw)':-2" -c:a aac -b:a 128k -movflags +faststart "${outFile}" 2>/dev/null`, { stdio: 'pipe' })
    const outSize = (statSync(outFile).size / 1024 / 1024).toFixed(1)
    const newPath = `videos/${id}-fs-${Date.now()}.mp4`
    const newUrl = await upload(outFile, newPath)
    cache.set(url, newUrl)
    try { unlinkSync(inFile); unlinkSync(outFile) } catch {}
    console.log(`    ✅ ${inSize}MB → ${outSize}MB`)
    return newUrl
  } catch (e) {
    console.log(`    ⚠ skip (${e.message})`)
    cache.set(url, url) // skip
    return url
  }
}

const cols = ['chineuse', 'iconiques']
for (const col of cols) {
  console.log(`\n=== ${col} ===`)
  const snap = await db.collection(col).get()
  for (const doc of snap.docs) {
    const data = doc.data()
    const videos = data.videos
    if (!Array.isArray(videos) || videos.length === 0) continue
    const newVids = []
    let changed = false
    for (const url of videos) {
      const newUrl = await reencodeOne(url)
      if (newUrl !== url) changed = true
      newVids.push(newUrl)
    }
    if (changed) {
      await doc.ref.update({ videos: newVids })
      console.log(`  ✏️ ${col}/${doc.id}: ${videos.length} vidéos mises à jour`)
    }
  }
}
console.log('\n✅ Done')
process.exit(0)
