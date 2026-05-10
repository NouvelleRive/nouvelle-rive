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
const v2 = await up('/tmp/ps2.mp4', `videos/DUBtk8OAjzz-${ts}.mp4`)
const v3 = await up('/tmp/ps3.mp4', `videos/DT0uxYlAjNy-${ts}.mp4`)
const ref = db.collection('chineuse').doc('personal-seller')
const cur = (await ref.get()).data().videos || []
const v = [...cur, v2, v3]
await ref.update({ videos: v })
console.log('✅ personal-seller.videos (' + v.length + ') =', v)
process.exit(0)
