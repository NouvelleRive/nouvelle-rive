import { instaToBunny } from './lib/video-utils.mjs'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

if (!getApps().length) {
  const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
  initializeApp({ credential: cert(sa) })
}
const db = getFirestore()

const reel = 'https://www.instagram.com/reel/DN-3xB5iNzt/?igsh=MXVkbWRwMHp0dw=='
const targetSku = 'IP65'
const chineuseId = 'ines-pineau'

console.log('→ Téléchargement + ré-encodage + upload Bunny du reel…')
const bunnyUrl = await instaToBunny(reel)
console.log('✅ Bunny URL :', bunnyUrl)

// 1. Ajout sur chineuse/ines-pineau (videos[])
const chRef = db.collection('chineuse').doc(chineuseId)
const chData = (await chRef.get()).data() || {}
const chVideos = chData.videos || []
if (chVideos.includes(bunnyUrl)) {
  console.log('   (déjà présent sur chineuse/ines-pineau, on saute)')
} else {
  await chRef.update({ videos: [...chVideos, bunnyUrl] })
  console.log('✅ Ajouté à chineuse/ines-pineau.videos')
}

// 2. Trouver le produit par sku
const prodSnap = await db.collection('produits').where('sku', '==', targetSku).limit(1).get()
if (prodSnap.empty) {
  console.log(`❌ Aucun produit avec sku=${targetSku} trouvé.`)
  process.exit(1)
}
const prodDoc = prodSnap.docs[0]
const prodData = prodDoc.data()
console.log(`→ Produit trouvé : ${prodDoc.id} (${prodData.nom})`)

// videoUrl (champ string single) + videos (array)
const update = {}
if (prodData.videoUrl !== bunnyUrl) update.videoUrl = bunnyUrl
const prodVideos = prodData.videos || []
if (!prodVideos.includes(bunnyUrl)) update.videos = [...prodVideos, bunnyUrl]

if (Object.keys(update).length === 0) {
  console.log('   (déjà présent sur le produit, rien à mettre à jour)')
} else {
  await prodDoc.ref.update(update)
  console.log('✅ Ajouté à produits/' + prodDoc.id, '(', Object.keys(update).join(' + '), ')')
}

process.exit(0)
