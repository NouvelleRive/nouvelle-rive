import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

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
const snap = await db.collection('iconiques').get()
const strass = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(i => i.slug === 'sac-strass-chronique')

if (!strass) {
  console.log('❌ iconique sac-strass-chronique introuvable')
  process.exit(1)
}

console.log('Avant :', strass.chineuseTrigrammes)
const cleaned = (strass.chineuseTrigrammes || []).filter(t => t.toUpperCase() !== 'ST')
console.log('Après :', cleaned)

await db.collection('iconiques').doc(strass.id).update({ chineuseTrigrammes: cleaned })
console.log('✅ Doc mis à jour')

// Invalide le blob cache iconiques pour forcer un refresh à la prochaine visite.
const file = getStorage().bucket().file('_cache/iconiques.json.gz')
const [exists] = await file.exists()
if (exists) {
  await file.delete()
  console.log('✅ Cache blob iconiques supprimé')
}
