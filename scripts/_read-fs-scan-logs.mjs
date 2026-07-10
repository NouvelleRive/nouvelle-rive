// Lit les logs [FS-SCAN] persistés dans _debug/scans/events sur les X dernières
// minutes et affiche un résumé par source. Sert à identifier ce qui pompe.

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

const minutes = parseInt(process.argv[2] || '60', 10)
const since = Date.now() - minutes * 60 * 1000

const snap = await db
  .collection('_debug')
  .doc('scans')
  .collection('events')
  .where('atMs', '>=', since)
  .orderBy('atMs', 'desc')
  .get()

console.log(`\n${snap.size} scans dans les ${minutes} dernières minutes\n`)

const bySource = new Map()
for (const doc of snap.docs) {
  const d = doc.data()
  const key = d.source
  if (!bySource.has(key)) bySource.set(key, { count: 0, totalDocs: 0, samples: [] })
  const s = bySource.get(key)
  s.count += 1
  s.totalDocs += d.docsCount || 0
  if (s.samples.length < 3) {
    s.samples.push({ atMs: d.atMs, docsCount: d.docsCount, ...d })
  }
}

const rows = [...bySource.entries()]
  .map(([source, s]) => ({
    source,
    calls: s.count,
    totalReads: s.totalDocs,
    avgPerCall: Math.round(s.totalDocs / s.count),
    readsPerMin: Math.round(s.totalDocs / minutes),
  }))
  .sort((a, b) => b.totalReads - a.totalReads)

console.table(rows)

// Sample derniers events pour chaque source (utile pour voir l'heure).
console.log('\nDerniers events (top 5 sources) :\n')
for (const row of rows.slice(0, 5)) {
  const samples = bySource.get(row.source).samples
  console.log(`\n[${row.source}]`)
  for (const s of samples) {
    const t = new Date(s.atMs).toISOString()
    console.log(`  ${t}  docs=${s.docsCount}  ${JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !['source', 'docsCount', 'atMs', 'at'].includes(k))))}`)
  }
}
