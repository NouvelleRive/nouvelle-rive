// Upload Jane reel (en 1ère vidéo de diamant-age-paris)
// + remplacer la vidéo Top Ana par la version HD trimmée -2.5s
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

// 1. Jane reel → diamant-age-paris en 1ère position
const janeUrl = await upload('/tmp/jane.mp4', `videos/DXhTRpsol_i-${Date.now()}.mp4`)
console.log('✅ Jane uploaded:', janeUrl)
const janeRef = db.collection('iconiques').doc('diamant-age-paris')
const janeV = [...((await janeRef.get()).data().videos || [])]
const janeFiltered = janeV.filter(u => u !== janeUrl)
janeFiltered.unshift(janeUrl)
await janeRef.update({ videos: janeFiltered })
console.log('✅ diamant-age-paris.videos =', janeFiltered)

// 2. Top Ana HD → top-ana-digger-sister (remplace le précédent trimmed)
const topanaUrl = await upload('/tmp/topana-final.mp4', `videos/DNFsbCPtZCS-hd-${Date.now()}.mp4`)
console.log('✅ Top Ana HD uploaded:', topanaUrl)
const taRef = db.collection('iconiques').doc('top-ana-digger-sister')
const taV = [topanaUrl] // remplace l'ancien
await taRef.update({ videos: taV })
console.log('✅ top-ana.videos =', taV)
process.exit(0)
