import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const ref = db.collection('iconiques').doc('lio-age-paris')
const v = [...((await ref.get()).data().videos || [])]
const newVid = 'https://nouvellerive.b-cdn.net/videos/DYFWaAGMjhe.mp4'
if (!v.includes(newVid)) v.splice(1, 0, newVid)
await ref.update({ videos: v })
console.log('✅ lio.videos =', v)
process.exit(0)
