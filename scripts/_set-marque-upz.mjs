// UPZ* -> UPZNSHIT
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()

const snap = await db.collection('produits').get()
const aEcrire = []
snap.forEach(d => {
  const p = d.data()
  const sku = (p.sku || '').toUpperCase().trim()
  if (!/^UPZ\d/.test(sku)) return
  if (p.marque === 'UPZNSHIT') return
  aEcrire.push({ id: d.id, sku, avant: p.marque ?? '(vide)' })
})

console.log(`${aEcrire.length} fiches a mettre a jour`)
aEcrire.forEach(x => console.log(` ${x.sku}  ${x.avant} -> UPZNSHIT`))
let batch = db.batch(); let ops = 0
for (const x of aEcrire) {
  batch.update(db.collection('produits').doc(x.id), { marque: 'UPZNSHIT' })
  if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0 }
}
if (ops) await batch.commit()
console.log('ecrit.')
process.exit(0)
