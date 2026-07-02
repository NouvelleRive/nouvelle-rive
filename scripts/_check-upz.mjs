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

// Chineuse UPZ ?
const chSnap = await db.collection('chineuses').where('trigramme', '==', 'UPZ').get()
console.log(`\n👤 Chineuse(s) trigramme UPZ : ${chSnap.size}`)
for (const d of chSnap.docs) {
  const c = d.data()
  console.log(`  ${d.id} — ${c.prenom} ${c.nom || ''} (${c.email || 'no email'})`)
}

// Pièces UPZ
const snap = await db.collection('produits').where('trigramme', '==', 'UPZ').get()
console.log(`\n📦 ${snap.size} pièce(s) avec trigramme UPZ`)

const stats = {
  total: 0,
  recu: 0,
  vendu: 0,
  retour: 0,
  supprime: 0,
  enBoutique: 0,
  sansDateReception: 0,
  notifJ30: 0,
  baisseDone: 0,
}

const enBoutique = []
for (const d of snap.docs) {
  const p = d.data()
  stats.total++
  if (p.statut === 'vendu') { stats.vendu++; continue }
  if (p.statut === 'retour') { stats.retour++; continue }
  if (p.statut === 'supprime') { stats.supprime++; continue }
  if (p.recu === true) stats.recu++
  stats.enBoutique++
  if (!p.dateReception) stats.sansDateReception++
  if (p.notifJ30SentAt) stats.notifJ30++
  if (p.baisse20Done) stats.baisseDone++
  enBoutique.push({
    id: d.id,
    sku: p.sku,
    nom: p.nom?.slice(0, 30),
    recu: p.recu,
    createdAt: p.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 10),
    dateReception: p.dateReception?.toDate?.()?.toISOString?.()?.slice(0, 10),
    notifJ30SentAt: p.notifJ30SentAt?.toDate?.()?.toISOString?.()?.slice(0, 10),
    baisse20Done: p.baisse20Done,
    prixBaisseLe: p.prixBaisseLe?.toDate?.()?.toISOString?.()?.slice(0, 10),
    statutRecuperation: p.statutRecuperation,
  })
}

console.log('\nStats :', stats)
console.log('\n📋 Pièces en boutique (non vendues/retour/supprime) :')
for (const p of enBoutique) {
  console.log(`  ${p.sku} | recu=${p.recu} | created=${p.createdAt} | reception=${p.dateReception} | notifJ30=${p.notifJ30SentAt} | baisse=${p.baisse20Done}/${p.prixBaisseLe} | statutRec=${p.statutRecuperation}`)
}

process.exit(0)
