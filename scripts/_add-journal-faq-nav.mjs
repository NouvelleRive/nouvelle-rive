import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

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
const ref = db.collection('siteConfig').doc('_nav')
const snap = await ref.get()
if (!snap.exists) {
  console.log('Doc _nav absent → la nav utilise le fallback statique (Journal/FAQ déjà présents). Rien à faire.')
  process.exit(0)
}

const data = snap.data()
const pages = Array.isArray(data?.pages) ? [...data.pages] : []

// Ancre : on place Journal et FAQ juste après "nous-rencontrer" (avant "boutique/TOUT VOIR").
const anchor = pages.find(p => p.path === '/nous-rencontrer')
const anchorOrder = anchor?.navOrder ?? 9

const toAdd = [
  {
    id: 'journal',
    path: '/journal',
    hash: '#titre',
    labelFr: 'JOURNAL',
    labelEn: 'JOURNAL',
    navOrder: anchorOrder + 0.3,
    hidden: false,
    isBuiltin: true,
    configurable: false,
  },
  {
    id: 'faq',
    path: '/faq',
    hash: '#titre',
    labelFr: 'FAQ',
    labelEn: 'FAQ',
    navOrder: anchorOrder + 0.6,
    hidden: false,
    isBuiltin: true,
    configurable: false,
  },
]

let changed = false
for (const entry of toAdd) {
  if (pages.some(p => p.path === entry.path)) {
    console.log(`↷ ${entry.path} déjà présent, ignoré`)
    continue
  }
  pages.push(entry)
  changed = true
  console.log(`＋ ${entry.path} ajouté (navOrder ${entry.navOrder})`)
}

if (!changed) {
  console.log('Rien à ajouter.')
  process.exit(0)
}

pages.sort((a, b) => (a.navOrder ?? 999) - (b.navOrder ?? 999))
await ref.update({ pages })
console.log('\n✅ Doc _nav mis à jour. Ordre final :')
console.log(pages.filter(p => !p.hidden).map(p => `${p.navOrder}\t${p.path}`).join('\n'))
process.exit(0)
