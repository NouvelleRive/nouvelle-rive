// 20 "Chemises Ralph Lauren" sous chineuse Nouvelle Rive (trigramme NR).
// Usage : node scripts/add-nr-ralph-lauren-20.mjs

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const chSnap = await db.collection('chineuse').where('trigramme', '==', 'NR').limit(1).get()
if (chSnap.empty) { console.error('❌ Aucune chineuse avec trigramme=NR'); process.exit(1) }
const chDoc = chSnap.docs[0]
const ch = chDoc.data()
const chineurUid = ch.authUid || ch.uid || chDoc.id
const chineurEmail = ch.email || null
console.log(`→ Chineuse NR : ${ch.nom || chDoc.id}`)

const prodSnap = await db.collection('produits').where('trigramme', '==', 'NR').get()
let maxNum = 0
prodSnap.forEach(d => {
  const m = (d.data().sku || '').toString().match(/^NR(\d+)$/i)
  if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n }
})
console.log(`→ Démarrage à NR${maxNum + 1}`)

const N = 20
for (let i = 0; i < N; i++) {
  const sku = `NR${maxNum + 1 + i}`
  const payload = {
    nom: `${sku} - Chemises Ralph Lauren`,
    categorie: 'haut',
    prix: 39,
    quantite: 1,
    marque: 'Ralph Laure',
    taille: 'M',
    color: null,
    sku,
    trigramme: 'NR',
    chineurUid,
    ...(chineurEmail ? { chineur: chineurEmail } : {}),
    imageUrls: [],
    imageUrl: '',
    photosReady: false,
    vendu: false,
    recu: false,
    createdAt: FieldValue.serverTimestamp(),
  }
  const ref = await db.collection('produits').add(payload)
  console.log(`✅ ${sku} → produits/${ref.id}`)
}

console.log(`\n✅ ${N} produits créés sous NR.`)
process.exit(0)
