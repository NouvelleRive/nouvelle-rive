// Cherche la vidéo de présentation Ines Pineau dans les iconiques + chineuses
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

console.log('=== Iconiques avec videos[] ===')
const icSnap = await db.collection('iconiques').get()
for (const d of icSnap.docs) {
  const x = d.data()
  if (x.videos?.length || x.videoUrl) {
    console.log(`  ${d.id}: nom="${x.nom}"`)
    if (x.videoUrl) console.log(`    videoUrl: ${x.videoUrl}`)
    ;(x.videos || []).forEach((v, i) => console.log(`    videos[${i}]: ${v}`))
  }
}

console.log('\n=== Chineuses (Ines Pineau, Brillante) avec videos ===')
const chSnap = await db.collection('chineuse').get()
for (const d of chSnap.docs) {
  const x = d.data()
  const nom = (x.nom || '').toLowerCase()
  if (nom.includes('pineau') || nom.includes('brillante') || x.videos?.length || x.videoUrl) {
    console.log(`  ${d.id}: nom="${x.nom}" trigramme=${x.trigramme}`)
    if (x.videoUrl) console.log(`    videoUrl: ${x.videoUrl}`)
    ;(x.videos || []).forEach((v, i) => console.log(`    videos[${i}]: ${v}`))
  }
}
process.exit(0)
