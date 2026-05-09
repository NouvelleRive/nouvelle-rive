// Upload 3 images depuis le bureau et les pose sur :
// - iconique bagues-voiture-ines-pineau (images = [bague1, bague2])
// - produit LeyViw99HklsDzpnGARG (premier élément de imageUrls = collier-montre)
// - tous les produits Bagues Voiture (ajout dans imageUrls)
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const BUNNY_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'

async function upload(localPath, bunnyPath) {
  const buf = readFileSync(localPath)
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'storage.bunnycdn.com', port: 443,
      path: `/nouvellerive/${bunnyPath}`, method: 'PUT',
      headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'image/jpeg', 'Content-Length': buf.length },
    }, (res) => res.statusCode === 201 ? resolve() : reject(new Error('Upload: ' + res.statusCode)))
    req.on('error', reject); req.write(buf); req.end()
  })
  return `https://nouvellerive.b-cdn.net/${bunnyPath}`
}

const ts = Date.now()
const bague1 = await upload('/Users/salomekassabi/Desktop/IMG_4555.jpg', `iconiques/bague-voiture-1-${ts}.jpg`)
const bague2 = await upload('/Users/salomekassabi/Desktop/IMG_4554.jpg', `iconiques/bague-voiture-2-${ts}.jpg`)
const colliMontre = await upload('/Users/salomekassabi/Desktop/IMG_4556.jpg', `produits/collier-montre-feature-${ts}.jpg`)
console.log('Uploaded:')
console.log('  bague1:', bague1)
console.log('  bague2:', bague2)
console.log('  collier-montre:', colliMontre)

// 1. Iconique bagues-voiture-ines-pineau : images = [bague1, bague2]
await db.collection('iconiques').doc('bagues-voiture-ines-pineau').update({ images: [bague1, bague2] })
console.log('✅ iconiques/bagues-voiture-ines-pineau.images posé')

// 2. Produit LeyViw99HklsDzpnGARG : ajouter colliMontre en 1ère position
const cmRef = db.collection('produits').doc('LeyViw99HklsDzpnGARG')
const cmSnap = await cmRef.get()
const cmData = cmSnap.data()
const cmExisting = (cmData.imageUrls || []).filter(u => u !== colliMontre)
const newImageUrls = [colliMontre, ...cmExisting]
await cmRef.update({ imageUrls: newImageUrls, imageUrl: colliMontre })
console.log(`✅ produits/LeyViw99HklsDzpnGARG.imageUrls (${newImageUrls.length})`)

// 3. Tous les produits "Bague Voiture" (= IP + nom contient "bague" + "voiture")
const ipSnap = await db.collection('produits').where('trigramme', '==', 'IP').get()
const baguesVoiture = ipSnap.docs.filter(d => {
  const p = d.data()
  const nom = (p.nom || '').toLowerCase()
  return /bague/.test(nom) && /voiture/.test(nom)
})
console.log(`${baguesVoiture.length} produits IP "Bague Voiture" trouvés`)
for (const d of baguesVoiture) {
  const p = d.data()
  const existing = (p.imageUrls || []).filter(u => u !== bague1 && u !== bague2)
  const newUrls = [bague1, bague2, ...existing]
  await d.ref.update({ imageUrls: newUrls, imageUrl: newUrls[0] })
  console.log(`  ✏️ ${p.sku || d.id}`)
}
process.exit(0)
