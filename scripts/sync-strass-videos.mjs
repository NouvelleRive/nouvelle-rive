import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const csnap = await db.collection('chineuse').where('slug', '==', 'strass-chronique').limit(1).get()
const chineuseVids = csnap.docs[0].data().videos || []
console.log(`Chineuse a ${chineuseVids.length} vidéos`)

await db.collection('iconiques').doc('sac-strass-chronique').update({ videos: chineuseVids })
console.log('Iconique mise à jour avec les 4 vidéos de la chineuse')
process.exit(0)
