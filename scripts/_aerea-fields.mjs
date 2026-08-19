import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }) })
const db=getFirestore()
const s=await db.collection('chineuse').doc('aerea-studio').get()
const d=s.data()||{}
console.log('nom:',d.nom,'| instagram:',d.instagram||d.instagramUrl||d.insta||'—','| videos:',(d.videos||[]).length)
console.log('champs:',Object.keys(d).join(', '))
process.exit(0)
