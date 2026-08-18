// Écriture inclusive (doublets/épicènes) + mention "retours" côté Vinted. Patch ciblé du store.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}

const PAIRS = [
  ['car le revendeur prend tout le risque et toute la marge', 'car la personne qui rachète prend tout le risque et toute la marge'],
  ['expédition, litiges et risques d’arnaque', 'expédition, retours, litiges et risques d’arnaque'],
  ['ni les acheteurs, ni les questions, ni les négociations, ni les livraisons, ni les arnaques', 'ni les acheteuses et acheteurs, ni les questions, ni les négociations, ni les livraisons, ni les retours, ni les arnaques'],
  ['un professionnel qui contrôle ses pièces', 'un·e professionnel·le qui contrôle ses pièces'],
  ['auprès d’un professionnel qui contrôle chaque pièce', 'auprès d’un·e professionnel·le qui contrôle chaque pièce'],
  ['## 1. Le prix, le vendeur et le canal de vente', '## 1. Le prix, la provenance et le canal de vente'],
  ['aux archives de créateurs', 'aux archives de créatrices et créateurs'],
  ['Un revendeur professionnel qui garantit ses pièces', 'Une boutique professionnelle qui garantit ses pièces'],
  ['auprès d’un professionnel reprend tout son sens', 'auprès d’un·e professionnel·le reprend tout son sens'],
  ['des vendeurs sans historique', 'des vendeuses et vendeurs sans historique'],
  ['le secret des bons chineurs', 'le secret des bonnes chineuses et bons chineurs'],
  ['Chaque Français jette en moyenne une douzaine de kilos de textiles par an', 'Chaque personne en France jette en moyenne une douzaine de kilos de textiles par an'],
]

const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get()
const articles = snap.data().articles
let total = 0
for (const a of articles) {
  if (!a.body) continue
  for (const [oldStr, newStr] of PAIRS) {
    if (a.body.includes(oldStr)) {
      a.body = a.body.split(oldStr).join(newStr)
      total++
      console.log(`  ✓ [${a.slug.slice(0, 22)}] ${oldStr.slice(0, 40)}…`)
    }
  }
}
await ref.set({ articles })
try { await getStorage().bucket().file('_cache/journal.json.gz').delete() } catch {}
console.log(`\n✓ ${total} remplacements appliqués`)
process.exit(0)
