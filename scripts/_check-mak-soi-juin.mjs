import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
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

const start = new Date(2026, 5, 1)              // 1 juin 2026 00:00
const end = new Date(2026, 6, 0, 23, 59, 59, 999) // 30 juin 2026 23:59

// 1. Trouver la chineuse MAKI et SOIR
const chSnap = await db.collection('chineuse').get()
const targets = []
for (const d of chSnap.docs) {
  const data = d.data()
  const nom = (data.nom || data.email || '').toLowerCase()
  const tri = (data.trigramme || '').toUpperCase()
  if (nom.includes('maki') || nom.includes('soir') || tri === 'MAK' || tri === 'SOI' || tri === 'SOIR') {
    targets.push({ id: d.id, nom: data.nom, email: data.email, trigramme: tri })
  }
}
console.log('--- Chineuses MAKI/SOIR ---')
targets.forEach(t => console.log(t))

// 2. Pour chaque cible, lister les ventes de juin
for (const t of targets) {
  console.log(`\n--- Ventes ${t.trigramme} (${t.nom || t.email}) — juin 2026 ---`)

  // via trigramme (filtre date en mémoire pour éviter d'exiger un index)
  const q1raw = await db.collection('ventes')
    .where('trigramme', '==', t.trigramme)
    .get()
  const q1docs = q1raw.docs.filter(d => {
    const dt = d.data().dateVente?.toDate?.()
    return dt && dt >= start && dt <= end
  })
  console.log(`Par trigramme="${t.trigramme}" : ${q1docs.length} ventes (sur ${q1raw.docs.length} total tri)`)

  // via email chineur
  const q2raw = await db.collection('ventes')
    .where('chineur', '==', t.email)
    .get()
  const q2docs = q2raw.docs.filter(d => {
    const dt = d.data().dateVente?.toDate?.()
    return dt && dt >= start && dt <= end
  })
  console.log(`Par chineur="${t.email}" : ${q2docs.length} ventes (sur ${q2raw.docs.length} total ch)`)

  // fusion sans doublon
  const seen = new Set()
  const rows = []
  for (const d of [...q1docs, ...q2docs]) {
    if (seen.has(d.id)) continue
    seen.add(d.id)
    const v = d.data()
    rows.push({
      id: d.id,
      sku: v.sku,
      trigramme: v.trigramme,
      chineur: v.chineur,
      prixVenteReel: v.prixVenteReel,
      prix: v.prix,
      date: v.dateVente?.toDate?.()?.toISOString?.().slice(0, 10),
      source: v.source,
    })
  }
  const ca = rows.reduce((s, r) => s + (r.prixVenteReel || r.prix || 0), 0)
  console.log(`TOTAL fusionné : ${rows.length} ventes — CA = ${ca}€`)
  console.log('Détail (id | sku | prix | date) :')
  rows.slice(0, 40).forEach(r => {
    console.log(`  ${r.id.padEnd(60)} ${(r.sku||'?').padEnd(12)} ${r.prixVenteReel||r.prix}€ ${r.date}`)
  })

  // Détection doublons : même SKU + même prix + même date
  const bySig = new Map()
  for (const r of rows) {
    const sig = `${r.sku}|${r.prixVenteReel||r.prix}|${r.date}`
    if (!bySig.has(sig)) bySig.set(sig, [])
    bySig.get(sig).push(r.id)
  }
  const dupes = [...bySig.entries()].filter(([, ids]) => ids.length > 1)
  if (dupes.length) {
    console.log(`\n  ⚠️  Doublons potentiels (même SKU+prix+jour) :`)
    for (const [sig, ids] of dupes) {
      console.log(`    ${sig} → ${ids.length}× : ${ids.join(' , ')}`)
    }
  }
}

// 3. Cherche aussi les ventes juin dont le SKU commence par MAK / SOI mais dont le trigramme diverge
console.log('\n--- Ventes juin avec SKU MAK* ou SOI* mais trigramme divergent ---')
const allJunRaw = await db.collection('ventes')
  .where('dateVente', '>=', Timestamp.fromDate(start))
  .get()
const allJun = allJunRaw.docs.filter(d => {
  const dt = d.data().dateVente?.toDate?.()
  return dt && dt <= end
})
console.log(`Ventes juin totales : ${allJun.length}`)
const mismatches = []
for (const d of allJun) {
  const v = d.data()
  const sku = (v.sku || '').toUpperCase()
  const tri = (v.trigramme || '').toUpperCase()
  if ((sku.startsWith('MAK') && tri !== 'MAK') || (sku.startsWith('SOI') && tri !== 'SOI' && tri !== 'SOIR')) {
    mismatches.push({ id: d.id, sku, tri, prix: v.prixVenteReel || v.prix, chineur: v.chineur })
  }
}
console.log(`Mismatches trouvés : ${mismatches.length}`)
mismatches.forEach(m => console.log(`  ${m.sku.padEnd(12)} tri="${m.tri}" ch="${m.chineur||''}" ${m.prix}€`))

process.exit(0)
