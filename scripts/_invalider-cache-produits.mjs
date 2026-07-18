// Supprime le blob de cache produits pour forcer sa régénération au prochain hit.
// À lancer après un script qui modifie des fiches produits, sinon le site sert
// l'ancien blob jusqu'à expiration du TTL (6 h).
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })

for (const key of process.argv.slice(2).length ? process.argv.slice(2) : ['produits-all']) {
  const file = getStorage().bucket().file(`_cache/${key}.json.gz`)
  const [exists] = await file.exists()
  if (!exists) { console.log(`${key} : déjà absent`); continue }
  await file.delete()
  console.log(`${key} : supprimé, sera régénéré au prochain chargement`)
}
