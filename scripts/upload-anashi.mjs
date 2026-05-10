import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

async function upload(localPath, bunnyPath) {
  const buf = readFileSync(localPath)
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'storage.bunnycdn.com', port: 443,
      path: `/nouvellerive/${bunnyPath}`, method: 'PUT',
      headers: { 'AccessKey': '26a0a715-8178-492a-b7f062ba4e09-786a-46b4', 'Content-Type': 'video/mp4', 'Content-Length': buf.length },
    }, (res) => res.statusCode === 201 ? resolve() : reject(new Error('Upload: ' + res.statusCode)))
    req.on('error', reject); req.write(buf); req.end()
  })
  return `https://nouvellerive.b-cdn.net/${bunnyPath}`
}

const ts = Date.now()
// Ordre : DWlZUjDiHsI (1), DUQ_lFrCEYG (milieu), DWYhg5dCAWs (3)
const v1 = await upload('/tmp/anashi-DWlZUjDiHsI.mp4', `videos/anashi-DWlZUjDiHsI-${ts}.mp4`)
const v2 = await upload('/tmp/anashi-DUQ_lFrCEYG.mp4', `videos/anashi-DUQ_lFrCEYG-${ts}.mp4`)
const v3 = await upload('/tmp/anashi-DWYhg5dCAWs.mp4', `videos/anashi-DWYhg5dCAWs-${ts}.mp4`)
console.log('Uploaded')
await db.collection('chineuse').doc('anashi').update({ videos: [v1, v2, v3] })
console.log('✅ chineuse/anashi.videos = 3 vidéos')
process.exit(0)
