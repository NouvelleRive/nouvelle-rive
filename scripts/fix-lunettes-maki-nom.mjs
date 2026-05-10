import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const ref = db.collection('iconiques').doc('lunettes-maki-upcy')
const before = (await ref.get()).data()
console.log('AVANT:', { nom: before.nom, nomEn: before.nomEn, nomPluriel: before.nomPluriel, nomPlurielEn: before.nomPlurielEn })

await ref.update({
  nom: 'Les Lunettes Upcyclées\nMAKI CORP',
  nomEn: 'The Upcycled Sunglasses\nMAKI CORP',
  nomPluriel: 'Lunettes Upcyclées MAKI CORP',
  nomPlurielEn: 'Upcycled Sunglasses MAKI CORP',
})

const after = (await ref.get()).data()
console.log('APRÈS:', { nom: after.nom, nomEn: after.nomEn, nomPluriel: after.nomPluriel, nomPlurielEn: after.nomPlurielEn })
process.exit(0)
