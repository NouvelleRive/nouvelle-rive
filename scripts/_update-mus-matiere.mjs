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

const APPLY = process.argv.includes('--apply')
const str = (v) => {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(str).join(' ')
  if (typeof v === 'object') return [v.label, v.name, v.nom, v.value, v.trigramme].filter(Boolean).join(' ')
  return String(v)
}

const snap = await db.collection('produits').where('trigramme', '==', 'MUS').get()
console.log(`📦 ${snap.size} produits MUS trouvés (mode=${APPLY ? 'APPLY' : 'DRY-RUN'})\n`)

let countPlaque = 0
let countLaiton = 0
let countSkip = 0
const batch = db.batch()

for (const d of snap.docs) {
  const p = d.data()
  const cat = str(p.categorie).toLowerCase()
  const isBO = cat.includes("boucles d'oreilles") || cat.includes("boucles d’oreilles")
  if (!isBO) {
    console.log(`  ⏭️  ${p.sku} | cat="${str(p.categorie)}" — pas une BO, skip`)
    countSkip++
    continue
  }
  const coul = (str(p.color) + ' ' + str(p.couleur)).toLowerCase()
  const hasArgent = /argent/.test(coul)
  const hasDore = /dor[ée]/.test(coul) || /\bgold\b/.test(coul)
  const newMatiere = hasArgent && !hasDore ? 'Laiton recyclé' : 'Laiton recyclé plaqué or'
  if (newMatiere === 'Laiton recyclé') countLaiton++
  else countPlaque++
  const newMarque = 'MUSE REBELLE'
  console.log(`  ${newMatiere === 'Laiton recyclé' ? '🥈' : '✨'} ${p.sku} | color="${str(p.color)}" | mat="${str(p.material || p.matiere)}"→"${newMatiere}" | marque="${str(p.marque)}"→"${newMarque}"`)
  if (APPLY) batch.update(d.ref, { material: newMatiere, matiere: newMatiere, marque: newMarque })
}

console.log(`\nRésumé : ${countPlaque} plaqué or | ${countLaiton} laiton recyclé | ${countSkip} skip`)
if (APPLY) {
  await batch.commit()
  console.log('✅ Batch committed')
} else {
  console.log('💡 Dry-run. Relance avec --apply pour écrire.')
}
process.exit(0)
