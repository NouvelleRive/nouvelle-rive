import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { addReelToChineuse } from './lib/video-utils.mjs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

await db.collection('chineuse').doc('sergio-tacchineur').update({ imagePosition: 'center top' })
console.log('✅ sergio.imagePosition = center top')

const url = await addReelToChineuse('sergio-tacchineur', 'https://www.instagram.com/reel/DSkT1T3Dcl1/')
console.log('✅ reel ajouté:', url)
process.exit(0)
