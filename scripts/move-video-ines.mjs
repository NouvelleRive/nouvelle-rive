// Déplace la vidéo "présentation Ines Pineau" de Brillante → Ines Pineau (créatrice + 2 iconiques)
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const dryRun = process.argv.includes('--apply') ? false : true
const VIDEO_INES = 'https://nouvellerive.b-cdn.net/videos/CtrbCWPtHRa.mp4'

console.log(dryRun ? '🟡 DRY RUN' : '🟢 APPLY')
console.log(`Vidéo à déplacer : ${VIDEO_INES}\n`)

async function patch(coll, id, mutate) {
  const ref = db.collection(coll).doc(id)
  const snap = await ref.get()
  if (!snap.exists) { console.log(`  ⚠️  ${coll}/${id} introuvable`); return }
  const before = snap.data().videos || []
  const after = mutate([...before])
  console.log(`  ${coll}/${id}`)
  console.log(`    avant: ${JSON.stringify(before)}`)
  console.log(`    après: ${JSON.stringify(after)}`)
  if (!dryRun) await ref.update({ videos: after })
}

// Retraits (Brillante)
console.log('— Retrait :')
await patch('iconiques', 'porte-briquet-brillante', (v) => v.filter(x => x !== VIDEO_INES))
await patch('chineuse', 'brillante', (v) => v.filter(x => x !== VIDEO_INES))

// Ajouts (Ines Pineau) — en première position
console.log('\n— Ajout (en première position si pas déjà présent) :')
const addFront = (v) => v.includes(VIDEO_INES) ? v : [VIDEO_INES, ...v]
await patch('chineuse', 'ines-pineau', addFront)
await patch('iconiques', 'collier-montre-ines-pineau', addFront)
await patch('iconiques', 'collier-torque-ines-pineau', addFront)

console.log(dryRun ? '\n(rien écrit — relance avec --apply)' : '\n✅ Appliqué')
process.exit(0)
