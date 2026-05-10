import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const ref = db.collection('iconiques').doc('collier-montre-ines-pineau')
const snap = await ref.get()
if (!snap.exists) { console.log('not found'); process.exit(1) }
const d = snap.data()

console.log('AVANT  :', { nom: d.nom, nomEn: d.nomEn, nomPluriel: d.nomPluriel, nomPlurielEn: d.nomPlurielEn })

const update = {
  nom: 'Le Collier Montre\nINES PINEAU',
  nomEn: 'The Watch Necklace\nINES PINEAU',
}
// Si pluriels existent on les ajuste aussi pour rester cohérent
if (d.nomPluriel) update.nomPluriel = 'Colliers Montre'
if (d.nomPlurielEn) update.nomPlurielEn = 'Watch Necklaces'

await ref.update(update)

const after = await ref.get()
console.log('APRÈS  :', { nom: after.data().nom, nomEn: after.data().nomEn, nomPluriel: after.data().nomPluriel, nomPlurielEn: after.data().nomPlurielEn })
console.log('OK')
process.exit(0)
