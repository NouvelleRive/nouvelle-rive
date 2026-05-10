import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const ref = db.collection('iconiques').doc('collier-montre-ines-pineau')
await ref.update({
  nomPluriel: 'Colliers Montre INES PINEAU',
  nomPlurielEn: 'Watch Necklaces INES PINEAU',
})
const after = (await ref.get()).data()
console.log({
  nom: after.nom,
  nomEn: after.nomEn,
  nomPluriel: after.nomPluriel,
  nomPlurielEn: after.nomPlurielEn,
})
process.exit(0)
