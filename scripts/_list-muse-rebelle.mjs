import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

const str = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? v.join(' ') : v == null ? '' : String(v))

// 1) Chineuses Muse Rebelle ?
const chSnap = await db.collection('chineuses').get()
const museChineuses = []
for (const d of chSnap.docs) {
  const c = d.data()
  const blob = `${str(c.prenom)} ${str(c.nom)} ${str(c.marque)} ${str(c.brand)} ${str(c.pseudo)} ${str(c.username)}`.toLowerCase()
  if (blob.includes('muse') && blob.includes('rebel')) {
    museChineuses.push({ id: d.id, trigramme: c.trigramme, prenom: c.prenom, nom: c.nom, marque: c.marque, pseudo: c.pseudo })
  }
}
console.log(`\n👤 Chineuses Muse Rebelle: ${museChineuses.length}`)
for (const c of museChineuses) console.log(`  trigramme=${c.trigramme} | ${c.prenom} ${c.nom || ''} | marque=${c.marque || ''} | pseudo=${c.pseudo || ''}`)

const museTrigrammes = museChineuses.map((c) => c.trigramme).filter(Boolean)

// 2) Produits Muse Rebelle (par trigramme ou par texte)
const snap = await db.collection('produits').get()
const matches = []
for (const d of snap.docs) {
  const p = d.data()
  const blob = `${str(p.nom)} ${str(p.modele)} ${str(p.marque)} ${str(p.brand)}`.toLowerCase()
  const isMuseText = blob.includes('muse rebelle') || blob.includes('muse-rebelle') || blob.includes('muserebelle')
  const isMuseTri = museTrigrammes.includes(p.trigramme)
  if (!isMuseText && !isMuseTri) continue
  const cat = str(p.categorie).toLowerCase()
  const isBO = cat.includes("boucles d'oreilles") || cat.includes("boucles d’oreilles") || cat.includes('boucle')
  matches.push({ id: d.id, sku: p.sku, trigramme: p.trigramme, nom: p.nom, modele: p.modele, categorie: p.categorie, couleur: p.couleur, matiere: p.matiere, statut: p.statut, isBO })
}

console.log(`\n📦 Produits liés à Muse Rebelle: ${matches.length} (dont BO: ${matches.filter((m) => m.isBO).length})\n`)
for (const m of matches) {
  const tag = m.isBO ? '💎BO' : '   '
  console.log(`  ${tag} ${m.sku} | tri=${m.trigramme} | cat="${str(m.categorie).slice(0, 25)}" | nom="${str(m.nom).slice(0, 45)}" | coul="${str(m.couleur)}" | mat="${str(m.matiere)}" | ${m.statut}`)
}
process.exit(0)
