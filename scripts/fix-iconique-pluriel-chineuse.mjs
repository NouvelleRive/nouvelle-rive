// Met à jour nomPluriel/nomPlurielEn avec le nom de la chineuse en MAJ
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const fixes = {
  'amadora-age-paris':            { nomPluriel: 'Vestes Amadora ÂGE PARIS',           nomPlurielEn: 'Amadora Blazers ÂGE PARIS' },
  'bagues-voiture-ines-pineau':   { nomPluriel: 'Bagues Voiture INES PINEAU',         nomPlurielEn: 'Car Rings INES PINEAU' },
  'bo-stacker-tete-dorange':      { nomPluriel: "BO à Stacker TÊTE D'ORANGE",         nomPlurielEn: "Stackable Earrings TÊTE D'ORANGE" },
  'chaine-pendante-tete-dorange': { nomPluriel: "Chaînes Pendantes TÊTE D'ORANGE",    nomPlurielEn: "Hanging Chains TÊTE D'ORANGE" },
  'chemises-digger-sister':       { nomPluriel: 'Chemises Upcyclées DIGGER SISTER',   nomPlurielEn: 'Upcycled Shirts DIGGER SISTER' },
  'collier-montre-ines-pineau':   { nomPluriel: 'Colliers Montre INES PINEAU',        nomPlurielEn: 'Watch Necklaces INES PINEAU' },
  'collier-torque-ines-pineau':   { nomPluriel: 'Colliers Torque INES PINEAU',        nomPlurielEn: 'Torque Necklaces INES PINEAU' },
  'diamant-age-paris':            { nomPluriel: 'Blazers Jane ÂGE PARIS',             nomPlurielEn: 'Jane Blazers ÂGE PARIS' },
  'lio-age-paris':                { nomPluriel: 'Blazers Lio ÂGE PARIS',              nomPlurielEn: 'Lio Blazers ÂGE PARIS' },
  'porte-briquet-brillante':      { nomPluriel: 'Porte-Briquets BRILLANTE',           nomPlurielEn: 'Lighter Cases BRILLANTE' },
  'sac-strass-chronique':         { nomPluriel: 'Sacs Strass STRASS CHRONIQUE',       nomPlurielEn: 'Strass Bags STRASS CHRONIQUE' },
  'set-ertha-digger-sister':      { nomPluriel: 'Sets Ertha DIGGER SISTER',           nomPlurielEn: 'Ertha Sets DIGGER SISTER' },
  'top-ana-digger-sister':        { nomPluriel: 'Tops Ana DIGGER SISTER',             nomPlurielEn: 'Ana Tops DIGGER SISTER' },
}

for (const [id, val] of Object.entries(fixes)) {
  const ref = db.collection('iconiques').doc(id)
  if (!(await ref.get()).exists) { console.log(`  ⚠️  ${id} introuvable`); continue }
  await ref.update(val)
  console.log(`  ✅ ${id}: "${val.nomPluriel}"`)
}
process.exit(0)
