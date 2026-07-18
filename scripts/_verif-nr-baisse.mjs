import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') }) })
}
const db = getFirestore()
for (const sku of ['NR123','NR120','NR119','NR108','NR107','NR102','NR100','NR94','NR92','NR51','NR50','NR49','NR43','NR41','NR87','NR37','NR26','NR23','NR22','NR21','NR20','NR9']) {
  const s = await db.collection('produits').where('sku','==',sku).get()
  for (const d of s.docs) {
    const p = d.data()
    const dt = p.prixBaisseLe?.toDate?.().toISOString().slice(0,10) || '?'
    console.log(`${sku.padEnd(6)} prix=${String(p.prix).padStart(4)} € | ancien=${String(p.ancienPrix ?? '?').padStart(4)} € | baisséLe=${dt} | etiquetteMaj=${p.etiquetteMaj}`)
  }
}
process.exit(0)
