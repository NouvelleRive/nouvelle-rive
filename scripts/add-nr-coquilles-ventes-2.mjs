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

const TRIGRAMME = 'NR'
const CHINEUR_UID = 'nouvelle-rive'
const CHINEUR_EMAIL = 'hinadrems1106@gmail.com'

const items = [
  { titre: 'bo chanel eli', prix: 490, marque: 'Chanel' },
]

const snap = await db.collection('produits').where('trigramme', '==', TRIGRAMME).get()
let maxNum = 0
const skuRe = /^NR(\d+)$/
snap.docs.forEach((d) => {
  const m = String(d.data().sku || '').match(skuRe)
  if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
})
let cursor = maxNum + 1
console.log(`Prochain SKU NR : NR${cursor}`)

for (const it of items) {
  const sku = `NR${cursor}`
  cursor++
  const payload = {
    nom: `${sku} - ${it.titre}`,
    description: '',
    categorie: '',
    marque: it.marque,
    taille: '',
    sku,
    trigramme: TRIGRAMME,
    chineurUid: CHINEUR_UID,
    chineur: CHINEUR_EMAIL,
    imageUrls: [],
    imageUrl: '',
    photosReady: false,
    vendu: false,
    recu: true,
    quantite: 1,
    prix: it.prix,
    createdAt: Timestamp.now(),
    source: 'admin-coquille',
  }
  const ref = await db.collection('produits').add(payload)
  console.log(`✓ ${sku} (${it.prix}€) — ${it.titre}`)
}

process.exit(0)
