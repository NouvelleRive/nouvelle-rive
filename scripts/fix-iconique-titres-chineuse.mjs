// Ajoute le nom de la chineuse en majuscules à la fin du titre des iconiques upcy
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const dryRun = process.argv.includes('--apply') ? false : true
console.log(dryRun ? '🟡 DRY RUN' : '🟢 APPLY')

const fixes = {
  'amadora-age-paris':            { nom: 'La Veste Amadora ÂGE PARIS',          nomEn: 'The Amadora Blazer ÂGE PARIS' },
  'bagues-voiture-ines-pineau':   { nom: 'Les Bagues Voiture INES PINEAU',      nomEn: 'The Car Rings INES PINEAU' },
  'bo-stacker-tete-dorange':      { nom: "Les BO à Stacker TÊTE D'ORANGE",      nomEn: "Stackable Earrings TÊTE D'ORANGE" },
  'chemises-digger-sister':       { nom: 'Les Chemises Upcyclées DIGGER SISTER', nomEn: 'The Upcycled Shirts DIGGER SISTER' },
  'collier-montre-ines-pineau':   { nom: 'Le Collier Montre INES PINEAU',       nomEn: 'The Watch Necklace INES PINEAU' },
  'collier-torque-ines-pineau':   { nom: 'Le Collier Torque INES PINEAU',       nomEn: 'The Torque Necklace INES PINEAU' },
  'diamant-age-paris':            { nom: 'Le Diamant ÂGE PARIS',                nomEn: 'The Diamant ÂGE PARIS' },
  'lio-age-paris':                { nom: 'Le Blazer Lio ÂGE PARIS',             nomEn: 'The Lio Blazer ÂGE PARIS' },
  'porte-briquet-brillante':      { nom: 'Le Porte-Briquet BRILLANTE',          nomEn: 'The Lighter Case BRILLANTE' },
  'set-ertha-digger-sister':      { nom: 'Le Set Ertha DIGGER SISTER',          nomEn: 'The Ertha Set DIGGER SISTER' },
  'top-ana-digger-sister':        { nom: 'Le Top Ana DIGGER SISTER',            nomEn: 'The Ana Top DIGGER SISTER' },
}

for (const [id, val] of Object.entries(fixes)) {
  const ref = db.collection('iconiques').doc(id)
  const snap = await ref.get()
  if (!snap.exists) { console.log(`  ⚠️  ${id} introuvable`); continue }
  const before = snap.data()
  console.log(`  ${id}`)
  console.log(`    "${before.nom}" → "${val.nom}"`)
  console.log(`    "${before.nomEn || ''}" → "${val.nomEn}"`)
  if (!dryRun) await ref.update(val)
}
console.log(`\n${Object.keys(fixes).length} iconiques mis à jour`)
process.exit(0)
