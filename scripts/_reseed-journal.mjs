// Vide le doc Journal + son blob cache pour forcer une regraine depuis le code.
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
const db = getFirestore()
await db.collection('siteConfig').doc('_journal').delete()
console.log('✓ doc siteConfig/_journal supprimé')
try {
  await getStorage().bucket().file('_cache/journal.json.gz').delete()
  console.log('✓ blob _cache/journal.json.gz supprimé')
} catch {
  console.log('· blob absent (ok)')
}
process.exit(0)
