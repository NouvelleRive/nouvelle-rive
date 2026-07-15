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

const snap = await db.collection('iconiques').get()
console.log(`Total: ${snap.size}`)
snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
  .forEach(i => {
    console.log(`[${i.type || '?'}] ordre=${i.ordre} | id=${i.id} | nom="${i.nom}" | marque="${i.marque}" | catRech="${i.categorieRecherche}" | display=${i.displayOnWebsite} | trigs=[${(i.chineuseTrigrammes || []).join(',')}] | catsIn=[${(i.categoriesIn || []).join(',')}]`)
  })
process.exit(0)
