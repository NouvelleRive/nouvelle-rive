import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('produits').where('vendu', '==', false).get()
const all = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(p => p.statut !== 'retour' && p.statut !== 'supprime' && p.hidden !== true)

const matches = (re) => all.filter(p => {
  const nom = (p.nom || p.Nom || '').toLowerCase()
  const cat = typeof p.categorie === 'object' ? (p.categorie?.label || '').toLowerCase() : (p.categorie || '').toLowerCase()
  return re.test(nom + ' ' + cat)
})

console.log('=== BROCHES ===')
matches(/broche|pin\b/i).slice(0, 20).forEach(p => {
  console.log(`  ${p.id}  nom="${p.nom || p.Nom}"  marque="${p.marque || ''}"  cat="${typeof p.categorie === 'object' ? p.categorie?.label : p.categorie}"`)
})

console.log('\n=== FOULARDS / CARRÉS / SCARVES ===')
matches(/foulard|carr[eé]|scarf|scarve/i).slice(0, 30).forEach(p => {
  console.log(`  ${p.id}  nom="${p.nom || p.Nom}"  marque="${p.marque || ''}"  cat="${typeof p.categorie === 'object' ? p.categorie?.label : p.categorie}"`)
})

process.exit(0)
