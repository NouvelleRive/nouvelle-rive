// Re-encode toutes les vidéos des iconiques upcy avec faststart + baseline iOS
// pour qu'elles démarrent en streaming progressif (autoplay sans télécharger toute la vidéo).
// Usage : node scripts/reencode-iconiques-videos.mjs [<id-iconique-optionnel>]
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { execSync } from 'child_process'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const BUNNY_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'
const TMP = '/tmp/reencode-iconiques'
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true })

const onlyId = process.argv[2] // optionnel : un id précis

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const chunks = []
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error('Download: ' + res.statusCode))
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => { writeFileSync(dest, Buffer.concat(chunks)); resolve() })
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

const snap = onlyId
  ? await db.collection('iconiques').doc(onlyId).get().then(d => ({ docs: d.exists ? [d] : [] }))
  : await db.collection('iconiques').where('type', '==', 'upcy').get()

console.log(`${snap.docs.length} iconique(s) à traiter\n`)

for (const doc of snap.docs) {
  const data = doc.data()
  const videos = Array.isArray(data.videos) ? data.videos : []
  const mp4s = videos.filter(u => /\.mp4(\?|$)/i.test(u))
  if (mp4s.length === 0) continue
  console.log(`\n=== ${doc.id} (${mp4s.length} vidéos mp4) ===`)
  const newVideos = []
  for (const url of videos) {
    if (!/\.mp4(\?|$)/i.test(url)) { newVideos.push(url); continue }
    const id = url.split('/').pop().replace(/\.mp4.*$/, '').replace(/-fs.*$/, '')
    const inFile = `${TMP}/${id}.mp4`
    const outFile = `${TMP}/${id}-fs.mp4`
    console.log(`  → ${id}`)
    try {
      await download(url, inFile)
      const inSize = (statSync(inFile).size / 1024 / 1024).toFixed(1)
      // H.264 baseline level 3.1 (compat iOS large), preset medium, CRF 23, max 1080px,
      // AAC audio, +faststart pour streaming progressif
      execSync(`ffmpeg -y -i "${inFile}" -c:v libx264 -profile:v baseline -level 3.1 -preset medium -crf 23 -vf "scale='min(1080,iw)':-2" -c:a aac -b:a 128k -movflags +faststart "${outFile}" -loglevel error`)
      const outSize = (statSync(outFile).size / 1024 / 1024).toFixed(1)
      const newPath = `videos/${id}-fs-${Date.now()}.mp4`
      const newUrl = await upload(outFile, newPath)
      console.log(`    ${inSize}MB → ${outSize}MB  ${newUrl}`)
      newVideos.push(newUrl)
    } catch (e) {
      console.error(`    ERREUR: ${e.message}`)
      newVideos.push(url) // garde l'ancienne en cas d'erreur
    }
  }
  await doc.ref.update({ videos: newVideos })
  console.log(`  ✅ ${doc.id}.videos mis à jour`)
}

console.log('\n✅ Terminé.')
process.exit(0)
