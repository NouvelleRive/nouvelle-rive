import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

const TRIGRAMME = 'GIGI'
const PHOTO_TEST = 'https://nouvellerive.b-cdn.net/produits/placeholder-test.jpg'

const ch = await db.collection('chineuse').where('trigramme', '==', TRIGRAMME).limit(1).get()
const chDoc = ch.docs[0]
const CHINEUR_UID = chDoc.id
const CHINEUR_EMAIL = chDoc.data().email || ''

const snap = await db.collection('produits').where('trigramme', '==', TRIGRAMME).get()
let maxNum = 0
const skuRe = new RegExp(`^${TRIGRAMME}(\\d+)$`)
snap.docs.forEach((d) => {
  const m = String(d.data().sku || '').match(skuRe)
  if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
})
const sku = `${TRIGRAMME}${maxNum + 1}`

const payload = {
  nom: `${sku} - deuxième nouvelle pièce à réceptionner`,
  description: 'produit test phase A',
  categorie: '',
  marque: '',
  taille: '',
  sku,
  trigramme: TRIGRAMME,
  chineurUid: CHINEUR_UID,
  chineur: CHINEUR_EMAIL,
  imageUrls: [PHOTO_TEST],
  imageUrl: PHOTO_TEST,
  photos: { face: PHOTO_TEST },
  photosReady: true,
  vendu: false,
  recu: false,
  quantite: 1,
  prix: 65,
  createdAt: Timestamp.now(),
  source: 'chineuse',
}
const ref = await db.collection('produits').add(payload)
console.log(`✓ ${sku} créé — id ${ref.id}`)
process.exit(0)
