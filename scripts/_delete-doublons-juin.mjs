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

const ids = [
  'RaLM1D4aD4ZUW3OERJQiVJ5JJbKZY_0d456219-9170-4e4b-b69d-127ce5f044cc', // SOI181 doublon
  'RaLM1D4aD4ZUW3OERJQiVJ5JJbKZY_bf054402-0f8d-46ed-91f8-2e1ffffa2e47', // MAKCHA doublon
  'fhLINym2ezCoPGy5crw06k66O0BZY_a5a73ff0-7319-4b58-a5d4-ebfda55f6d20', // MAKDIO 06-09 (1 des 2)
]

for (const id of ids) {
  const ref = db.collection('ventes').doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    console.log(`⚠️  ${id} : introuvable`)
    continue
  }
  const v = snap.data()
  await ref.delete()
  console.log(`✅ Supprimé : ${id} (sku=${v.sku} prix=${v.prixVenteReel||v.prix}€)`)
}

process.exit(0)
