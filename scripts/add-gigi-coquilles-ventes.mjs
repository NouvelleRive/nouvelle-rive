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

const ch = await db.collection('chineuse').where('trigramme', '==', TRIGRAMME).limit(1).get()
if (ch.empty) {
  console.error(`Chineuse ${TRIGRAMME} introuvable`)
  process.exit(1)
}
const chDoc = ch.docs[0]
const CHINEUR_UID = chDoc.id
const CHINEUR_EMAIL = chDoc.data().email || ''
console.log(`Chineuse ${TRIGRAMME} : ${CHINEUR_UID} (${CHINEUR_EMAIL})`)

const items = [
  { titre: "boucles d'oreills gigi",  prix: 80 },
  { titre: 'gigi clip multi cercles', prix: 72 },
  { titre: 'gigi BO fleur violettes', prix: 90 },
  { titre: 'bo gigi ronde dorees',    prix: 80 },
  { titre: 'gigi bo rondes dorees',   prix: 80 },
  { titre: 'gigi broche fleurie et gros cristal blanc', prix: 80 },
]

const snap = await db.collection('produits').where('trigramme', '==', TRIGRAMME).get()
let maxNum = 0
const skuRe = new RegExp(`^${TRIGRAMME}(\\d+)$`)
snap.docs.forEach((d) => {
  const m = String(d.data().sku || '').match(skuRe)
  if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
})
let cursor = maxNum + 1
console.log(`Prochain SKU : ${TRIGRAMME}${cursor}`)

for (const it of items) {
  const sku = `${TRIGRAMME}${cursor}`
  cursor++
  const payload = {
    nom: `${sku} - ${it.titre}`,
    description: '',
    categorie: '',
    marque: '',
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
