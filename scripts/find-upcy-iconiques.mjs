// Recherche les 10 pièces upcy iconiques pour confirmer ID + photos avant seed.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const norm = (s) =>
  (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’\-_.\s]+/g, '')

const SEARCHES = [
  { label: '1. Collier montre Ines Pineau', tri: 'IP', kwAll: ['montre'] },
  { label: '2. Top Ana Digger Sister', tri: 'DISI', kwAll: ['ana'] },
  { label: '3. Amadora ÂGE Paris', tri: 'AGE', kwAll: ['amadora'] },
  { label: '4. Set ERTHA Digger Sister', tri: 'DISI', kwAll: ['ertha'] },
  { label: '5. Collier torque Ines Pineau', tri: 'IP', kwAll: ['torque'] },
  { label: '6. Lunettes Maki upcy', tri: 'MAK', kwAll: [] },
  { label: '7. Chemises Digger Sister', tri: 'DISI', kwAll: ['chemise'] },
  { label: '8. Porte briquet Brillante "burn the fascist"', tri: null, kwAll: ['burn'], kwAny: ['briquet', 'burn', 'fascist'] },
  { label: '9. Lio ÂGE Paris', tri: 'AGE', kwAll: ['lio'] },
  { label: "10. Chaîne pendante Tête d'Orange", tri: 'TDO', kwAll: ['pendant'] },
  { label: '11. Sac Strass Chronique', tri: 'ST', kwAll: ['sac'] },
  { label: '12. Bagues voiture Ines Pineau', tri: 'IP', kwAll: ['bague', 'voiture'] },
]

const snap = await db.collection('produits').where('vendu', '==', false).get()
const all = snap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((p) => (p.quantite ?? 1) > 0 && p.statut !== 'retour' && p.statut !== 'supprime')

console.log('TOTAL produits actifs : ' + all.length)
console.log('─'.repeat(80))

for (const s of SEARCHES) {
  console.log(`\n${s.label}  (tri=${s.tri || '*'}, kwAll=${s.kwAll.join('+')})`)
  let hits = all
  if (s.tri) hits = hits.filter((p) => (p.trigramme || '').toUpperCase() === s.tri)

  hits = hits.filter((p) => {
    const nom = norm(p.nom || '')
    const cat = norm(typeof p.categorie === 'object' ? p.categorie?.label : p.categorie)
    const desc = norm(p.description || '')
    const blob = nom + ' ' + cat + ' ' + desc
    if (s.kwAll && s.kwAll.length > 0) {
      if (!s.kwAll.every((kw) => blob.includes(norm(kw)))) return false
    }
    if (s.kwAny && s.kwAny.length > 0) {
      if (!s.kwAny.some((kw) => blob.includes(norm(kw)))) return false
    }
    return true
  })

  if (hits.length === 0) {
    console.log('  ✗ Aucun hit')
    continue
  }
  for (const h of hits.slice(0, 8)) {
    const img = h.imageUrls?.[0] || h.imageUrl || h.photos?.face || '(sans photo)'
    console.log(`  • [${h.id}] tri=${h.trigramme || '?'} | ${h.nom || '(sans nom)'}`)
    console.log(`      ${img}`)
  }
  if (hits.length > 8) console.log(`  ... +${hits.length - 8} autres`)
}
