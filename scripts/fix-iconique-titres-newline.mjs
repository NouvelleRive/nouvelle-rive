// Repasse les titres iconiques upcy avec un \n entre le nom et la chineuse
// + renomme diamant-age-paris en "Le Blazer Jane"
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const dryRun = process.argv.includes('--apply') ? false : true
console.log(dryRun ? '🟡 DRY RUN' : '🟢 APPLY')

const fixes = {
  'amadora-age-paris':            { nom: 'La Veste Amadora\nÂGE PARIS',           nomEn: 'The Amadora Blazer\nÂGE PARIS' },
  'bagues-voiture-ines-pineau':   { nom: 'Les Bagues Voiture\nINES PINEAU',       nomEn: 'The Car Rings\nINES PINEAU' },
  'bo-stacker-tete-dorange':      { nom: "Les BO à Stacker\nTÊTE D'ORANGE",       nomEn: "Stackable Earrings\nTÊTE D'ORANGE" },
  'chemises-digger-sister':       { nom: 'Les Chemises Upcyclées\nDIGGER SISTER', nomEn: 'The Upcycled Shirts\nDIGGER SISTER' },
  'collier-montre-ines-pineau':   { nom: 'Le Collier Montre\nINES PINEAU',        nomEn: 'The Watch Necklace\nINES PINEAU' },
  'collier-torque-ines-pineau':   { nom: 'Le Collier Torque\nINES PINEAU',        nomEn: 'The Torque Necklace\nINES PINEAU' },
  'diamant-age-paris':            { nom: 'Le Blazer Jane\nÂGE PARIS',             nomEn: 'The Jane Blazer\nÂGE PARIS', nomPluriel: 'Blazers Jane', nomPlurielEn: 'Jane Blazers' },
  'lio-age-paris':                { nom: 'Le Blazer Lio\nÂGE PARIS',              nomEn: 'The Lio Blazer\nÂGE PARIS' },
  'porte-briquet-brillante':      { nom: 'Le Porte-Briquet\nBRILLANTE',           nomEn: 'The Lighter Case\nBRILLANTE' },
  'set-ertha-digger-sister':      { nom: 'Le Set Ertha\nDIGGER SISTER',           nomEn: 'The Ertha Set\nDIGGER SISTER' },
  'top-ana-digger-sister':        { nom: 'Le Top Ana\nDIGGER SISTER',             nomEn: 'The Ana Top\nDIGGER SISTER' },
}

for (const [id, val] of Object.entries(fixes)) {
  const ref = db.collection('iconiques').doc(id)
  const snap = await ref.get()
  if (!snap.exists) { console.log(`  ⚠️  ${id} introuvable`); continue }
  console.log(`  ${id}: nom="${val.nom.replace('\n','⏎')}"`)
  if (!dryRun) await ref.update(val)
}
console.log(`\n${Object.keys(fixes).length} iconiques mis à jour`)
process.exit(0)
