import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

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

console.log('=== Chineuses smallBatch ===')
const chSnap = await db.collection('chineuse').get()
const smallBatchTrig = new Set()
chSnap.docs.forEach(d => {
  const data = d.data()
  if (data.stockType === 'smallBatch') {
    const trig = (data.trigramme || '').toUpperCase()
    smallBatchTrig.add(trig)
    console.log(`- ${trig} | ${data.nom || d.id}`)
  }
})

console.log(`\nTrigrammes smallBatch : ${[...smallBatchTrig].join(', ')}`)
console.log(`Trigrammes cleanés aujourd'hui : BON, EQU, RAS`)
const impact = ['BON', 'EQU', 'RAS'].filter(t => smallBatchTrig.has(t))
if (impact.length === 0) {
  console.log('✓ Aucune smallBatch touchée par les cleanups')
} else {
  console.log(`⚠️ Attention : ${impact.join(', ')} sont smallBatch et ont été impactées`)
}
process.exit(0)
