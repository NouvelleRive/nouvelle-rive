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
  { titre: 'nr foulard',                                          prix: 10,  marque: '' },
  { titre: 'nr robe longue fleurie',                              prix: 140, marque: '' },
  { titre: 'NR21 VESTE DAIM MARRON ET BRODERIE',                  prix: 95,  marque: '' },
  { titre: 'veste cuir NR mi longue noire fourrure sur capuche',  prix: 100, marque: '' },
  { titre: 'nr veste lilith',                                     prix: 140, marque: '' },
  { titre: 'nr manteau burberry laine',                           prix: 450, marque: 'Burberry' },
  { titre: 'NR VESTE CACHAREL NOIR',                              prix: 75,  marque: 'Cacharel' },
  { titre: 'nr veste cuir',                                       prix: 190, marque: '' },
  { titre: 'nr trench burberry',                                  prix: 450, marque: 'Burberry' },
  { titre: 'nr fendi enveloppe',                                  prix: 680, marque: 'Fendi' },
]

// Calcule le prochain SKU NR
const snap = await db.collection('produits').where('trigramme', '==', TRIGRAMME).get()
let maxNum = 0
const skuRe = /^NR(\d+)$/
snap.docs.forEach((d) => {
  const m = String(d.data().sku || '').match(skuRe)
  if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
})
let cursor = maxNum + 1
console.log(`Prochain SKU NR : NR${cursor}`)

const created = []
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
  created.push({ id: ref.id, sku, titre: it.titre, prix: it.prix })
  console.log(`✓ ${sku} (${it.prix}€) — ${it.titre}`)
}

console.log(`\n${created.length} produits créés.`)
process.exit(0)
