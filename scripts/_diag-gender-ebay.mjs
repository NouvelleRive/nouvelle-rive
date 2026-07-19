// Diag GENDER_REQUIRED : pourquoi la résolution trigramme -> wearType échoue dans sync-ebay-luxe.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
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

const chineusesSnap = await db.collection('chineuse').get()
const map = new Map()
for (const d of chineusesSnap.docs) {
  const c = d.data()
  if (c.trigramme) map.set(c.trigramme.toUpperCase(), c.wearType || '(vide->womenswear)')
}
console.log(`Chineuses avec trigramme : ${map.size}`)
console.log([...map.entries()].map(([t, w]) => `${t}=${w}`).join(', '))

for (const sku of ['NR134', 'CAM111', 'NR20', 'CAM143']) {
  const snap = await db.collection('produits').where('sku', '==', sku).limit(1).get()
  if (snap.empty) { console.log(`\n${sku} : introuvable`); continue }
  const p = snap.docs[0].data()
  const tri = (p.chineuse || p.trigramme || (p.sku ? p.sku.match(/^([A-Z]{2,4})/i)?.[1] : null) || '').toString().toUpperCase()
  console.log(`\n${sku} : marque=${p.marque} | p.chineuse=${JSON.stringify(p.chineuse)} | p.trigramme=${JSON.stringify(p.trigramme)}`)
  console.log(`  -> trigramme calculé = "${tri}" | wearType trouvé = ${map.get(tri) ?? 'AUCUN ❌'}`)
}
