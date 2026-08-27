// Crée (ou met à jour) le doc chineuse dédié ACHETEUSE (trigramme ACH).
// Compte maison à la commission — copie les catégories du compte NR.
// Le user Firebase Auth est créé automatiquement à la 1re connexion Google.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}) })
const db = getFirestore()

const EMAIL = 'nouvelleriveachats@gmail.com'
const DOC_ID = 'nouvelle-rive-achats'

// Récupère les catégories du compte NR pour les réutiliser (même boutique/Square)
const nrSnap = await db.collection('chineuse').where('trigramme', '==', 'NR').get()
if (nrSnap.empty) { console.error('❌ Doc NR introuvable'); process.exit(1) }
const nr = nrSnap.docs[0].data()

const ref = db.collection('chineuse').doc(DOC_ID)
const existing = await ref.get()

const payload = {
  nom: 'NOUVELLE RIVE ACHATS',
  trigramme: 'ACH',
  email: EMAIL,
  emails: [EMAIL],
  taux: 0,                    // à la commission, pas à la rétrocession
  isAcheteuse: true,          // flag rôle acheteuse (module découpable)
  displayOnWebsite: false,    // pas un profil public
  'Catégorie': nr['Catégorie'] || [],
  'Catégorie de rapport': nr['Catégorie de rapport'] || [],
  stockType: nr.stockType || null,
  wearType: nr.wearType || null,
  updatedAt: new Date(),
  ...(existing.exists ? {} : { createdAt: new Date() }),
}

await ref.set(payload, { merge: true })
const after = await ref.get()
const d = after.data()
console.log(existing.exists ? '♻️  Doc ACH mis à jour' : '✅ Doc ACH créé', '→', DOC_ID)
console.log('  trigramme:', d.trigramme, '| email:', d.email, '| taux:', d.taux, '| isAcheteuse:', d.isAcheteuse)
console.log('  Catégorie:', Array.isArray(d['Catégorie']) ? d['Catégorie'].length + ' catégories' : 0)
process.exit(0)
