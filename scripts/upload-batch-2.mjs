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
      headers: { 'AccessKey': '26a0a715-8178-492a-b7f062ba4e09-786a-46b4', 'Content-Type': 'image/jpeg', 'Content-Length': buf.length },
    }, (res) => res.statusCode === 201 ? resolve() : reject(new Error('Upload: ' + res.statusCode)))
    req.on('error', reject); req.write(buf); req.end()
  })
  return `https://nouvellerive.b-cdn.net/${bunnyPath}`
}

const ts = Date.now()
const HOME = process.env.HOME
const bagueVoiture = await upload(`${HOME}/Desktop/IMG_4557.jpg`, `iconiques/bague-voiture-3-${ts}.jpg`)
const collierMontre1 = await upload(`${HOME}/Desktop/IMG_4558.jpg`, `iconiques/collier-montre-2-${ts}.jpg`)
const collierMontre2 = await upload(`${HOME}/Desktop/IMG_4559.jpg`, `iconiques/collier-montre-3-${ts}.jpg`)
console.log('Uploaded:')
console.log('  bague voiture:', bagueVoiture)
console.log('  collier montre dos:', collierMontre1)
console.log('  collier montre portrait:', collierMontre2)

// 1. Iconique bagues-voiture-ines-pineau : ajouter bagueVoiture aux images existantes
const bvRef = db.collection('iconiques').doc('bagues-voiture-ines-pineau')
const bvData = (await bvRef.get()).data()
const bvImages = [...(bvData.images || []), bagueVoiture].filter((x, i, arr) => arr.indexOf(x) === i)
await bvRef.update({ images: bvImages })
console.log(`✅ iconiques/bagues-voiture-ines-pineau.images (${bvImages.length})`)

// 2. Iconique collier-montre-ines-pineau : ajouter les 2 images
const cmRef = db.collection('iconiques').doc('collier-montre-ines-pineau')
const cmData = (await cmRef.get()).data()
const cmImages = [...(cmData.images || []), collierMontre1, collierMontre2].filter((x, i, arr) => arr.indexOf(x) === i)
await cmRef.update({ images: cmImages })
console.log(`✅ iconiques/collier-montre-ines-pineau.images (${cmImages.length})`)

// 3. Tous les produits Bague Voiture : ajouter bagueVoiture en début
const ipSnap = await db.collection('produits').where('trigramme', '==', 'IP').get()
const baguesVoiture = ipSnap.docs.filter(d => {
  const nom = (d.data().nom || '').toLowerCase()
  return /bague/.test(nom) && /voiture/.test(nom)
})
for (const d of baguesVoiture) {
  const p = d.data()
  const existing = (p.imageUrls || []).filter(u => u !== bagueVoiture)
  const newUrls = [bagueVoiture, ...existing]
  await d.ref.update({ imageUrls: newUrls, imageUrl: newUrls[0] })
}
console.log(`✅ ${baguesVoiture.length} produits Bague Voiture mis à jour`)

// 4. Tous les produits Collier Montre IP : ajouter les 2 images en début
const colliersMontre = ipSnap.docs.filter(d => {
  const nom = (d.data().nom || '').toLowerCase()
  return /collier/.test(nom) && /montre/.test(nom)
})
for (const d of colliersMontre) {
  const p = d.data()
  const existing = (p.imageUrls || []).filter(u => u !== collierMontre1 && u !== collierMontre2)
  const newUrls = [collierMontre1, collierMontre2, ...existing]
  await d.ref.update({ imageUrls: newUrls, imageUrl: newUrls[0] })
}
console.log(`✅ ${colliersMontre.length} produits Collier Montre mis à jour`)
process.exit(0)
