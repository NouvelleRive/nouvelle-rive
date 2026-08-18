// Corrige l'article dépôt-vente (conditions réelles NOUVELLE RIVE) + 4 corrections inclusives restantes.
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

// Remplacements globaux (apostrophes DROITES, comme dans le contenu).
const GLOBAL = [
  ["expédition, litiges et risques d'arnaque", "expédition, retours, litiges et risques d'arnaque"],
  ["auprès d'un professionnel qui contrôle chaque pièce", "auprès d'un·e professionnel·le qui contrôle chaque pièce"],
  ["auprès d'un professionnel reprend tout son sens", "auprès d'un·e professionnel·le reprend tout son sens"],
  ["car le revendeur prend tout le risque et toute la marge", "car la personne qui rachète prend tout le risque et toute la marge"],
]

// Remplacements spécifiques dépôt-vente.
const DEPOT = [
  [
    "Chez Nouvelle Rive, on ne se limite pas au sac de marque : vintage de luxe, pièces de créateur, upcyclé, régénéré. Chaque portant est composé par une créatrice ou curateurice différente, avec son propre univers.",
    "Chez Nouvelle Rive, le dépôt de particulier concerne les pièces de marque en bon état : prêt-à-porter, sacs, bijoux et chaussures. Chaque pièce proposée est validée par notre équipe avant la mise en vente.",
  ],
  [
    "Sur le marché du luxe, la commission d'un dépôt-vente se situe le plus souvent entre 30 et 50 %, parfois dégressive sur les pièces les plus chères. Le prix de vente est fixé pour être juste : assez attractif pour partir, assez haut pour vous rémunérer correctement. Vous êtes payé après la vente.",
    "Chez Nouvelle Rive, la règle est claire : vous récupérez 60 à 70 % de la valeur de vente — au choix, 60 % en cash ou 70 % en bons d'achat valables sans limite de temps. Le dépôt dure deux mois (30 jours, renouvelables 30 jours sous condition d'une baisse de prix). Vous choisissez votre mode de paiement chaque mois, versé le 10 du mois suivant. Vous n'êtes payé·e qu'une fois la pièce vendue.",
  ],
  [
    "Une fois acceptée, votre pièce est authentifiée, mise en valeur et photographiée par notre équipe.",
    "Une fois validée, votre pièce est mise en valeur et présentée dans les meilleures conditions.",
  ],
  [
    "Vous suivez tout depuis votre espace.",
    "Vous suivez tout depuis votre espace. Le détail complet — commission, durée du dépôt, articles acceptés — est sur notre page dédiée aux conditions de dépôt.",
  ],
]

const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get()
const articles = snap.data().articles
let total = 0
for (const a of articles) {
  if (!a.body) continue
  for (const [o, n] of GLOBAL) if (a.body.includes(o)) { a.body = a.body.split(o).join(n); total++; console.log('  ✓ [global]', o.slice(0, 45)) }
  if (a.slug === 'depot-vente-luxe-paris') {
    for (const [o, n] of DEPOT) {
      if (a.body.includes(o)) { a.body = a.body.split(o).join(n); total++; console.log('  ✓ [dépôt]', o.slice(0, 45)) }
      else console.log('  ✗ NON TROUVÉ:', o.slice(0, 55))
    }
    a.cta = { href: '/client/deposant/conditions', label: 'Voir les conditions de dépôt →' }
    console.log('  ✓ CTA → /client/deposant/conditions')
  }
}
await ref.set({ articles })
try { await getStorage().bucket().file('_cache/journal.json.gz').delete() } catch {}
console.log(`\n✓ ${total} remplacements`)
process.exit(0)
