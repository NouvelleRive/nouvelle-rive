import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, statSync } from 'fs'
import { execSync } from 'child_process'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const REEL_ID = 'Cqs8u5qgkCQ'
const inFile = `/tmp/${REEL_ID}.mp4`
const outFile = `/tmp/${REEL_ID}-fs.mp4`

execSync(`ffmpeg -y -i "${inFile}" -c:v libx264 -profile:v baseline -level 3.1 -preset medium -crf 23 -vf "scale='min(1080,iw)':-2" -c:a aac -b:a 128k -movflags +faststart "${outFile}" -loglevel error`)
console.log(`Encodé: ${(statSync(inFile).size/1024/1024).toFixed(1)}MB → ${(statSync(outFile).size/1024/1024).toFixed(1)}MB`)

const buf = readFileSync(outFile)
const path = `videos/${REEL_ID}-fs-${Date.now()}.mp4`
await new Promise((resolve, reject) => {
  const req = https.request({
    hostname: 'storage.bunnycdn.com', port: 443,
    path: `/nouvellerive/${path}`, method: 'PUT',
    headers: { 'AccessKey': '26a0a715-8178-492a-b7f062ba4e09-786a-46b4', 'Content-Type': 'video/mp4', 'Content-Length': buf.length },
  }, (res) => res.statusCode === 201 ? resolve() : reject(new Error('Upload: ' + res.statusCode)))
  req.on('error', reject); req.write(buf); req.end()
})
const NEW_URL = `https://nouvellerive.b-cdn.net/${path}`
console.log('Uploaded:', NEW_URL)

const ref = db.collection('iconiques').doc('bagues-voiture-ines-pineau')
const cur = (await ref.get()).data().videos || []
const next = [NEW_URL, ...cur]
await ref.update({ videos: next })
console.log(`✅ bagues-voiture: ${next.length} vidéos (nouvelle en 1ère)`)
process.exit(0)
