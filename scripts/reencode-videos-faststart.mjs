// Re-encode les vidéos d'une chineuse avec faststart + baseline iOS
// pour permettre le streaming progressif (= autoplay sans download complet).
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const BUNNY_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'
const TMP = '/tmp/reencode'
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true })

const target = process.argv[2] // e.g. "brillante" or "anashi"
if (!target) { console.error('Usage: node script.mjs <chineuse-id>'); process.exit(1) }

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = []
    https.get(url, (res) => {
      res.on('data', (c) => file.push(c))
      res.on('end', () => { writeFileSync(dest, Buffer.concat(file)); resolve() })
      res.on('error', reject)
    })
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

const ref = db.collection('chineuse').doc(target)
const cur = (await ref.get()).data().videos || []
const newVideos = []
for (const url of cur) {
  if (!/\.mp4(\?|$)/i.test(url)) { newVideos.push(url); continue }
  const id = url.split('/').pop().replace(/\.mp4.*$/, '')
  const inFile = `${TMP}/${id}.mp4`
  const outFile = `${TMP}/${id}-fs.mp4`
  console.log(`→ ${id}`)
  await download(url, inFile)
  // Re-encode: H.264 baseline, faststart (moov en tête), audio AAC, taille raisonnable
  execSync(`ffmpeg -y -i "${inFile}" -c:v libx264 -profile:v baseline -level 3.1 -preset medium -crf 23 -vf "scale='min(1080,iw)':-2" -c:a aac -b:a 128k -movflags +faststart "${outFile}" 2>&1 | tail -2`)
  const newPath = `videos/${id}-fs-${Date.now()}.mp4`
  const newUrl = await upload(outFile, newPath)
  console.log(`  ✅ ${newUrl}`)
  newVideos.push(newUrl)
}
await ref.update({ videos: newVideos })
console.log(`\n✅ ${target}.videos =`, newVideos)
process.exit(0)
