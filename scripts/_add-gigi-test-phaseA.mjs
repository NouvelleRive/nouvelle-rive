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
if (ch.empty) { console.error('Chineuse GIGI introuvable'); process.exit(1) }
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
let cursor = maxNum + 1
console.log(`Prochain SKU : ${TRIGRAMME}${cursor}`)

const now = new Date()
const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d }

const items = [
  {
    titre: 'rouge — demande sortie déjà faite (1)',
    prix: 45,
    recu: true,
    dateReception: Timestamp.fromDate(daysAgo(20)),
    statutRecuperation: 'aRecuperer',
    dateSignalement: Timestamp.fromDate(daysAgo(5)),
  },
  {
    titre: 'rouge — demande sortie déjà faite (2)',
    prix: 55,
    recu: true,
    dateReception: Timestamp.fromDate(daysAgo(35)),
    statutRecuperation: 'aRecuperer',
    dateSignalement: Timestamp.fromDate(daysAgo(2)),
  },
  {
    titre: 'orange — prix à baisser (2.5 mois en boutique)',
    prix: 70,
    recu: true,
    dateReception: Timestamp.fromDate(daysAgo(75)), // ~2.5 mois
  },
  {
    titre: 'rouge — là depuis +3 mois, aurait dû être récupérée',
    prix: 90,
    recu: true,
    dateReception: Timestamp.fromDate(daysAgo(100)), // ~3.3 mois
  },
  {
    titre: 'nouvelle pièce à réceptionner (trigger popup)',
    prix: 40,
    recu: false,
  },
]

const created = []
for (const it of items) {
  const sku = `${TRIGRAMME}${cursor}`
  cursor++
  const payload = {
    nom: `${sku} - ${it.titre}`,
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
    recu: it.recu,
    quantite: 1,
    prix: it.prix,
    createdAt: Timestamp.now(),
    source: 'chineuse',
    ...(it.dateReception ? { dateReception: it.dateReception } : {}),
    ...(it.statutRecuperation ? {
      statutRecuperation: it.statutRecuperation,
      dateSignalement: it.dateSignalement,
    } : {}),
  }
  const ref = await db.collection('produits').add(payload)
  created.push({ sku, id: ref.id, titre: it.titre })
  console.log(`✓ ${sku} — ${it.titre}`)
}

console.log('\n✅ 5 produits créés.')
console.log('   Va sur /vendeuse/restock → réceptionne la dernière pièce → le popup doit lister 3 rouges + 1 orange.')
process.exit(0)
