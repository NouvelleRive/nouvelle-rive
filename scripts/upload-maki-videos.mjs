// Upload 2 vidéos Maki sur Bunny et les ajoute à chineuse maki-corp
// + iconique lunettes-maki-upcy
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
const v1 = await upload('/tmp/maki.mp4', `videos/DGVKO5MiN7e-${ts}.mp4`)
const v2 = await upload('/tmp/maki2.mp4', `videos/DT5Zbt7Dd0X-${ts}.mp4`)
const v3 = await upload('/tmp/maki3.mp4', `videos/DBYvohrC5l6-${ts}.mp4`)
console.log('Uploaded:', v1, v2, v3)
const allVids = [v1, v2, v3]

// Chercher la chineuse Maki (peut être 'maki-corp' ou trigramme MAK)
const chSnap = await db.collection('chineuse').get()
let makiId = null
for (const d of chSnap.docs) {
  const x = d.data()
  if (x.trigramme === 'MAK' || /maki/i.test(x.nom || '')) { makiId = d.id; break }
}
if (makiId) {
  const ref = db.collection('chineuse').doc(makiId)
  const cur = (await ref.get()).data().videos || []
  const merged = [...cur]
  for (const v of allVids) if (!merged.includes(v)) merged.push(v)
  await ref.update({ videos: merged })
  console.log(`✅ chineuse/${makiId}.videos (${merged.length})`)
}

const lmRef = db.collection('iconiques').doc('lunettes-maki-upcy')
const lmCur = (await lmRef.get()).data().videos || []
const lmMerged = [...lmCur]
for (const v of allVids) if (!lmMerged.includes(v)) lmMerged.push(v)
await lmRef.update({ videos: lmMerged })
console.log(`✅ iconiques/lunettes-maki-upcy.videos (${lmMerged.length})`)
process.exit(0)
