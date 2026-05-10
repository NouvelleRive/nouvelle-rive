import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, statSync } from 'fs'
import { execSync } from 'child_process'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const BUNNY_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’\-_.\s]+/g, '')

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

console.log('Encodage + upload des 2 reels :')
const url1 = await uploadEncoded('Cqs8u5qgkCQ')
const url2 = await uploadEncoded('Co2m3ZWgX7s')
const newUrls = [url1, url2]
console.log('URLs:', newUrls)

const snap = await db.collection('produits').where('trigramme', '==', 'IP').get()
const matches = snap.docs.filter(d => {
  const p = d.data()
  if (p.statut === 'retour' || p.statut === 'supprime') return false
  const nom = norm(p.nom || '')
  const cat = typeof p.categorie === 'object' ? norm(p.categorie?.label || '') : norm(p.categorie || '')
  return (nom.includes('bague') && nom.includes('voiture')) || (cat.includes('bague') && nom.includes('voiture'))
})
console.log(`\n${matches.length} produits "bague voiture" IP à mettre à jour`)

for (const doc of matches) {
  const cur = doc.data().videos || []
  // On dédoublonne
  const merged = Array.from(new Set([...newUrls, ...cur]))
  await doc.ref.update({ videos: merged })
  console.log(`  ✅ ${doc.data().sku} → ${merged.length} vidéos`)
}

// Aussi sur l'iconique : on remplace le contenu actuel par les 2 nouveaux + ce qu'il y avait
const iref = db.collection('iconiques').doc('bagues-voiture-ines-pineau')
const cur = (await iref.get()).data().videos || []
const merged = Array.from(new Set([...newUrls, ...cur]))
await iref.update({ videos: merged })
console.log(`\n✅ Iconique bagues-voiture: ${merged.length} vidéos`)
process.exit(0)
