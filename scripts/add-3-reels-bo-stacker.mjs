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
  console.log(`  ${reelId}: ${(statSync(inFile).size/1024/1024).toFixed(1)}MB → ${(statSync(outFile).size/1024/1024).toFixed(1)}MB`)
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

const url1st = await uploadEncoded('C9aX55vC2d_')
const url2 = await uploadEncoded('DDhXhrksp6W')
const url3 = await uploadEncoded('C-ch2JOCavt')

const ref = db.collection('iconiques').doc('bo-stacker-tete-dorange')
const cur = (await ref.get()).data().videos || []
console.log(`\nAVANT: ${cur.length} vidéos`)
// 1ère = url1st, puis url2 et url3 ajoutés à la suite (avant le contenu existant ? ou après ? Le user a juste dit "ajoute" pour les 2 autres)
// Interprétation : url1st en 1ère position (explicite), url2 et url3 ajoutés à la fin de l'existant
const next = [url1st, ...cur.filter(u => u !== url1st), url2, url3]
await ref.update({ videos: next })
console.log(`APRÈS: ${next.length} vidéos`)
next.forEach((v, i) => console.log(`  ${i+1}. ${v}`))
process.exit(0)
