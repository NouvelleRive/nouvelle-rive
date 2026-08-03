import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({
  credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
})
const bucket = getStorage().bucket()
const [files] = await bucket.getFiles({ prefix: '_cache/' })
console.log('Fichiers _cache :')
for (const f of files) console.log(`  ${f.name}  updated=${f.metadata.updated}  size=${f.metadata.size}`)
process.exit(0)
