import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const BUNNY_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'
const path = `videos/DNFsbCPtZCS-trimmed-${Date.now()}.mp4`
const buf = readFileSync('/tmp/reel-trimmed.mp4')

await new Promise((resolve, reject) => {
  const req = https.request({
    hostname: 'storage.bunnycdn.com', port: 443,
    path: `/nouvellerive/${path}`, method: 'PUT',
    headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'video/mp4', 'Content-Length': buf.length },
  }, (res) => res.statusCode === 201 ? resolve() : reject(new Error('Upload: ' + res.statusCode)))
  req.on('error', reject); req.write(buf); req.end()
})
const url = `https://nouvellerive.b-cdn.net/${path}`
console.log('✅ Uploaded:', url)

const ref = db.collection('iconiques').doc('top-ana-digger-sister')
const snap = await ref.get()
const v = [...(snap.data().videos || []), url]
await ref.update({ videos: v })
console.log('✅ top-ana.videos =', v)
process.exit(0)
