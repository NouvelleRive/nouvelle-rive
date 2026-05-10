import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const ref = db.collection('iconiques').doc('collier-montre-ines-pineau')
const snap = await ref.get()
if (!snap.exists) { console.log('not found'); process.exit(1) }

const videos = snap.data().videos || []
console.log('AVANT:')
videos.forEach((v, i) => console.log(`  ${i + 1}. ${v}`))

if (videos.length < 3) { console.log('Pas assez de vidéos pour réordonner'); process.exit(1) }

// Bouge la vidéo en position 1 (index 0) vers la position 3 (index 2)
const newOrder = [videos[1], videos[2], videos[0], ...videos.slice(3)]

console.log('APRÈS:')
newOrder.forEach((v, i) => console.log(`  ${i + 1}. ${v}`))

await ref.update({ videos: newOrder })
console.log('OK')
process.exit(0)
