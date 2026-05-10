import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, statSync } from 'fs'
import { execSync } from 'child_process'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const BUNNY_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'

async function uploadEncoded(reelId) {
  const inFile = `/tmp/${reelId}.mp4`
  const outFile = `/tmp/${reelId}-fs.mp4`
  execSync(`ffmpeg -y -i "${inFile}" -c:v libx264 -profile:v baseline -level 3.1 -preset medium -crf 23 -vf "scale='min(1080,iw)':-2" -c:a aac -b:a 128k -movflags +faststart "${outFile}" -loglevel error`)
  console.log(`  ${reelId} encodé (${(statSync(outFile).size/1024/1024).toFixed(1)}MB)`)
  const buf = readFileSync(outFile)
  const path = `videos/${reelId}-fs-${Date.now()}.mp4`
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'storage.bunnycdn.com', port: 443,
      path: `/nouvellerive/${path}`, method: 'PUT',
      headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'video/mp4', 'Content-Length': buf.length },
    }, (res) => res.statusCode === 201 ? resolve() : reject(new Error('Upload: ' + res.statusCode)))
    req.on('error', reject); req.write(buf); req.end()
  })
  return `https://nouvellerive.b-cdn.net/${path}`
}

const url2nd = await uploadEncoded('CnXV6ElIbgJ')   // position 2
const urlEnd = await uploadEncoded('CnGyLXho63X')   // à la fin

const ref = db.collection('iconiques').doc('bagues-voiture-ines-pineau')
const cur = (await ref.get()).data().videos || []
console.log('AVANT:', cur.length, 'vidéos')
// Insère url2nd en position 1 (= 2ème), ajoute urlEnd à la fin
const next = [cur[0], url2nd, ...cur.slice(1), urlEnd]
await ref.update({ videos: next })
console.log('APRÈS:')
next.forEach((v, i) => console.log(`  ${i+1}. ${v}`))
process.exit(0)
