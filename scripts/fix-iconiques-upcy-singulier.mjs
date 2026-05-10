import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// id → { nom, nomEn } singuliers (le nomPluriel/En existe déjà avec le suffixe chineuse, on n'y touche pas)
const fixes = {
  'amadora-age-paris':           { nom: 'La Veste Amadora\nÂGE PARIS',           nomEn: 'The Amadora Blazer\nÂGE PARIS' },
  'bagues-voiture-ines-pineau':  { nom: 'La Bague Voiture\nINES PINEAU',          nomEn: 'The Car Ring\nINES PINEAU' },
  'bo-stacker-tete-dorange':     { nom: "La BO à Stacker\nTÊTE D'ORANGE",         nomEn: "Stackable Earring\nTÊTE D'ORANGE" },
  'chaine-pendante-tete-dorange':{ nom: "La Chaîne Pendante\nTÊTE D'ORANGE",      nomEn: "Hanging Chain\nTÊTE D'ORANGE" },
  'chemises-digger-sister':      { nom: 'La Chemise Upcyclée\nDIGGER SISTER',     nomEn: 'The Upcycled Shirt\nDIGGER SISTER' },
  'collier-torque-ines-pineau':  { nom: 'Le Collier Torque\nINES PINEAU',         nomEn: 'The Torque Necklace\nINES PINEAU' },
  'diamant-age-paris':           { nom: 'Le Blazer Jane\nÂGE PARIS',              nomEn: 'The Jane Blazer\nÂGE PARIS' },
  'lio-age-paris':               { nom: 'Le Blazer Lio\nÂGE PARIS',               nomEn: 'The Lio Blazer\nÂGE PARIS' },
  'porte-briquet-brillante':     { nom: 'Le Porte-Briquet\nBRILLANTE',            nomEn: 'The Lighter Case\nBRILLANTE' },
  'sac-strass-chronique':        { nom: 'Le Sac Strass\nSTRASS CHRONIQUE',        nomEn: 'The Strass Bag\nSTRASS CHRONIQUE' },
  'set-ertha-digger-sister':     { nom: 'Le Set Ertha\nDIGGER SISTER',            nomEn: 'The Ertha Set\nDIGGER SISTER' },
  'top-ana-digger-sister':       { nom: 'Le Top Ana\nDIGGER SISTER',              nomEn: 'The Ana Top\nDIGGER SISTER' },
  // Note : lunettes-maki-upcy laissé au pluriel (lunettes = pluriel-tantum en FR & EN)
  // Note : collier-montre-ines-pineau déjà corrigé
}

for (const [id, vals] of Object.entries(fixes)) {
  const ref = db.collection('iconiques').doc(id)
  const snap = await ref.get()
  if (!snap.exists) { console.log(`SKIP ${id} (introuvable)`); continue }
  const before = snap.data()
  await ref.update(vals)
  console.log(`OK  ${id}`)
  console.log(`    nom    : ${JSON.stringify(before.nom)} → ${JSON.stringify(vals.nom)}`)
  console.log(`    nomEn  : ${JSON.stringify(before.nomEn)} → ${JSON.stringify(vals.nomEn)}`)
}

console.log('\nFini.')
process.exit(0)
