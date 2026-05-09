// Pose nomPluriel + nomPlurielEn sur les iconiques au singulier
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const fixes = {
  'collier-montre-ines-pineau':       { nomPluriel: 'Colliers Montre',                nomPlurielEn: 'Watch Necklaces' },
  'collier-torque-ines-pineau':       { nomPluriel: 'Colliers Torque',                nomPlurielEn: 'Torque Necklaces' },
  'lio-age-paris':                    { nomPluriel: 'Blazers Lio',                    nomPlurielEn: 'Lio Blazers' },
  'top-ana-digger-sister':            { nomPluriel: 'Tops Ana',                       nomPlurielEn: 'Ana Tops' },
  'diamant-age-paris':                { nomPluriel: 'Diamants',                       nomPlurielEn: 'Diamonds' },
  'porte-briquet-brillante':          { nomPluriel: 'Porte-Briquets',                 nomPlurielEn: 'Lighter Cases' },
  'sac-strass-chronique':             { nomPluriel: 'Sacs Strass Chronique',          nomPlurielEn: 'Strass Chronique Bags' },
  'set-ertha-digger-sister':          { nomPluriel: 'Sets Ertha',                     nomPlurielEn: 'Ertha Sets' },
  'amadora-age-paris':                { nomPluriel: 'Vestes Amadora',                 nomPlurielEn: 'Amadora Blazers' },
  'chaine-pendante-tete-dorange':     { nomPluriel: 'Chaînes Pendantes Tête d\'Orange', nomPlurielEn: 'Tête d\'Orange Hanging Chains' },
  'baguette-fendi':                   { nomPluriel: 'Baguettes Fendi',                nomPlurielEn: 'Fendi Baguettes' },
  'revenge-dress':                    { nomPluriel: 'Revenge Dresses',                nomPlurielEn: 'Revenge Dresses' },
}

for (const [id, val] of Object.entries(fixes)) {
  const ref = db.collection('iconiques').doc(id)
  const snap = await ref.get()
  if (!snap.exists) { console.log(`  ⚠️  ${id} introuvable`); continue }
  await ref.update(val)
  console.log(`  ✅ ${id} → "${val.nomPluriel}" / "${val.nomPlurielEn}"`)
}
console.log(`\n${Object.keys(fixes).length} iconiques mis à jour`)
process.exit(0)
