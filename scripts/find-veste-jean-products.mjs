import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const snap = await db.collection('produits').where('vendu', '==', false).get()
const matches = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(p => p.statut !== 'retour' && p.statut !== 'supprime' && p.hidden !== true)
  .filter(p => {
    const nom = (p.nom || p.Nom || '').toLowerCase()
    const cat = typeof p.categorie === 'object' ? (p.categorie?.label || '').toLowerCase() : (p.categorie || '').toLowerCase()
    const material = (p.material || '').toLowerCase()
    return /veste|jacket|trucker|denim/i.test(nom + ' ' + cat) && /jean|denim/i.test(nom + ' ' + cat + ' ' + material)
  })

console.log(`${matches.length} matches`)
matches.slice(0, 20).forEach(p => {
  console.log(`  ${p.id}  nom="${p.nom || p.Nom}"  marque="${p.marque || ''}"  cat="${typeof p.categorie === 'object' ? p.categorie?.label : p.categorie}"  mat="${p.material || ''}"`)
})
process.exit(0)
