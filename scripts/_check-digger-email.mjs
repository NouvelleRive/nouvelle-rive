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
const snap = await db.collection('chineuse').get()
const targets = ['DICL', 'AIME', 'AIM']
console.log('id | nom | trigramme | email | emails[]')
console.log('---')
snap.docs.forEach(d => {
  const data = d.data()
  const trig = (data.trigramme || '').toUpperCase()
  const nom = (data.nom || '').toLowerCase()
  if (targets.includes(trig) || nom.includes('digger') || nom.includes('aim')) {
    console.log(`${d.id} | ${data.nom} | ${data.trigramme} | ${data.email || '(VIDE)'} | ${JSON.stringify(data.emails || [])}`)
  }
})
process.exit(0)
