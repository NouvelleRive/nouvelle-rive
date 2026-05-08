// Inspecte la config d'une page (siteConfig/<pageId>) pour comprendre les règles de filtrage
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const pageId = process.argv[2] || 'new-in'
const sku = (process.argv[3] || 'AGE145').toUpperCase()

const cfgSnap = await db.collection('siteConfig').doc(pageId).get()
if (!cfgSnap.exists) {
  console.log(`❌ Pas de config pour pageId=${pageId}`)
  process.exit(0)
}
const cfg = cfgSnap.data()
console.log(`━━━ siteConfig/${pageId} ━━━`)
console.log('  regles         :', JSON.stringify(cfg.regles || [], null, 2))
console.log('  prixMin        :', cfg.prixMin)
console.log('  prixMax        :', cfg.prixMax)
console.log('  joursRecents   :', cfg.joursRecents)
console.log('')

// Récupérer le produit
const psnap = await db.collection('produits').where('sku', '==', sku).limit(1).get()
if (psnap.empty) { console.log(`❌ ${sku} introuvable`); process.exit(0) }
const p = psnap.docs[0].data()

// Récupérer toutes les chineuses
const chSnap = await db.collection('chineuse').get()
const chineuses = chSnap.docs.map(d => ({ uid: d.id, ...d.data() }))

// Identifier la chineuse de AGE145
const tri = sku.match(/^[A-Za-z]+/)?.[0]?.toUpperCase()
const chOfSku = chineuses.find(c => c.trigramme?.toUpperCase() === tri)
console.log(`━━━ Chineuse pour SKU ${sku} (trigramme ${tri}) ━━━`)
if (chOfSku) {
  console.log('  uid            :', chOfSku.uid)
  console.log('  nom            :', chOfSku.nom)
  console.log('  email          :', chOfSku.email)
  console.log('  trigramme      :', chOfSku.trigramme)
  console.log('  stockType      :', chOfSku.stockType)
  console.log('  actif          :', chOfSku.actif)
} else {
  console.log(`  ⚠️  AUCUNE chineuse trouvée pour le trigramme ${tri}`)
}
console.log('')

// Tester chaque règle de la page
console.log(`━━━ Test des règles ${pageId} sur ${sku} ━━━`)
const matchCritere = (produit, critere) => {
  const v = critere.valeur
  const vL = (v || '').toString().toLowerCase()
  const op = critere.operateur || 'EST'
  const champ = critere.champ
  switch (champ) {
    case 'categorie': {
      const cat = (produit.categorie?.label || produit.categorie || '').toString().toLowerCase()
      if (op === 'EST') return cat === vL
      if (op === 'CONTIENT') return cat.includes(vL)
      if (op === 'PAS') return cat !== vL
      return false
    }
    case 'description': return (produit.description || '').toLowerCase().includes(vL)
    case 'marque':      return (produit.marque || '').toLowerCase().includes(vL)
    case 'chineuse': {
      const ch = chineuses.find(c => c.uid === v)
      if (!ch) return false
      const m1 = produit.chineur === ch.email
      const m2 = produit.chineurUid === ch.uid
      const t = ch.trigramme?.toUpperCase() || '???'
      const skuU = produit.sku?.toUpperCase() || ''
      const m3 = skuU.startsWith(t) && (skuU.length === t.length || /\d/.test(skuU[t.length]))
      return m1 || m2 || m3
    }
    default: return false
  }
}

if (!cfg.regles || cfg.regles.length === 0) {
  console.log('  Aucune règle → tous les produits non vendus passent')
} else {
  cfg.regles.forEach((r, i) => {
    const ok = r.criteres.length > 0 && r.criteres.every(c => matchCritere(p, c))
    console.log(`  Règle ${i}: ${ok ? '✅ MATCH' : '❌ pas de match'}`, JSON.stringify(r.criteres))
  })
  const anyMatch = cfg.regles.some(r => r.criteres.length > 0 && r.criteres.every(c => matchCritere(p, c)))
  console.log('  ─────────────')
  console.log(`  Résultat global : ${anyMatch ? '✅ AGE145 doit apparaître' : '⛔ AGE145 EXCLU par les règles'}`)
}
process.exit(0)
