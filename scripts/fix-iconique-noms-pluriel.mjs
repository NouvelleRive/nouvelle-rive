// Met les noms iconiques au pluriel (Le → Les, ajoute s) pour le titre hero
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const fixes = {
  'amadora-age-paris':            { nom: 'Les Vestes Amadora\nÂGE PARIS',          nomEn: 'The Amadora Blazers\nÂGE PARIS' },
  'bo-stacker-tete-dorange':      { nom: "Les BO à Stacker\nTÊTE D'ORANGE",         nomEn: "Stackable Earrings\nTÊTE D'ORANGE" },
  'chaine-pendante-tete-dorange': { nom: "Les Chaînes Pendantes\nTÊTE D'ORANGE",    nomEn: "Hanging Chains\nTÊTE D'ORANGE" },
  'collier-montre-ines-pineau':   { nom: 'Les Colliers Montre\nINES PINEAU',       nomEn: 'The Watch Necklaces\nINES PINEAU' },
  'collier-torque-ines-pineau':   { nom: 'Les Colliers Torque\nINES PINEAU',       nomEn: 'The Torque Necklaces\nINES PINEAU' },
  'diamant-age-paris':            { nom: 'Les Blazers Jane\nÂGE PARIS',            nomEn: 'The Jane Blazers\nÂGE PARIS' },
  'lio-age-paris':                { nom: 'Les Blazers Lio\nÂGE PARIS',             nomEn: 'The Lio Blazers\nÂGE PARIS' },
  'lunettes-maki-upcy':           { nom: 'Les Lunettes Maki\nMAKI CORP',            nomEn: 'Maki Sunglasses\nMAKI CORP', nomPluriel: 'Lunettes Maki MAKI CORP', nomPlurielEn: 'Maki Sunglasses MAKI CORP' },
  'porte-briquet-brillante':      { nom: 'Les Porte-Briquets\nBRILLANTE',          nomEn: 'The Lighter Cases\nBRILLANTE' },
  'sac-strass-chronique':         { nom: 'Les Sacs Strass\nSTRASS CHRONIQUE',      nomEn: 'The Strass Bags\nSTRASS CHRONIQUE', nomPluriel: 'Sacs Strass STRASS CHRONIQUE' },
  'set-ertha-digger-sister':      { nom: 'Les Sets Ertha\nDIGGER SISTER',          nomEn: 'The Ertha Sets\nDIGGER SISTER' },
  'top-ana-digger-sister':        { nom: 'Les Tops Ana\nDIGGER SISTER',            nomEn: 'The Ana Tops\nDIGGER SISTER' },
}

for (const [id, val] of Object.entries(fixes)) {
  const ref = db.collection('iconiques').doc(id)
  if (!(await ref.get()).exists) { console.log(`  ⚠️  ${id} introuvable`); continue }
  await ref.update(val)
  console.log(`  ✅ ${id}: "${val.nom.replace('\n', '⏎')}"`)
}
process.exit(0)
