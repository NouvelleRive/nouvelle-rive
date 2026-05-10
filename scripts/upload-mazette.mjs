import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import https from 'https'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
async function up(local, bunnyPath) {
  const buf = readFileSync(local)
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
const v1 = await up('/tmp/mazette.mp4', `videos/DXUBqqSjV-m-${ts}.mp4`)
const v2 = await up('/tmp/mazette2.mp4', `videos/DWzY3y0jW5F-${ts}.mp4`)
await db.collection('chineuse').doc('mazette').update({ videos: [v1, v2] })
console.log('✅ mazette.videos =', [v1, v2])
process.exit(0)
