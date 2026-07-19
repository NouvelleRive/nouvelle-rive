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
const snap = await db.collection('iconiques').get()

const upcy = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(i => i.displayOnWebsite !== false && (i.type || 'vintage') === 'upcy')
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))

console.log(`\n${upcy.length} iconiques upcy trouvées :\n`)
for (const i of upcy) {
  const imgs = Array.isArray(i.images) ? i.images.length : 0
  const vids = Array.isArray(i.videos) ? i.videos.length : 0
  console.log(`  ${(i.nom || '?').padEnd(35)} images=${imgs} videos=${vids}  slug=${i.slug || i.id}`)
  if (imgs === 0 || vids === 0) {
    console.log(`    ⚠️  raw.images=${JSON.stringify(i.images)}`)
    console.log(`    ⚠️  raw.videos=${JSON.stringify(i.videos)}`)
  } else {
    for (const url of i.images) console.log(`      img: ${url}`)
    for (const url of i.videos) console.log(`      vid: ${url}`)
  }
}
