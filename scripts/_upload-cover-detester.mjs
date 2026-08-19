import { readFileSync } from 'fs'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
const zone=process.env.BUNNY_STORAGE_ZONE, key=process.env.BUNNY_API_KEY, cdn=process.env.NEXT_PUBLIC_BUNNY_CDN_URL
const path='journal/detester-fast-fashion.jpg'
const buf=readFileSync('/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/574b8f36-fb06-47a8-8294-2f5892431202/scratchpad/img0404.jpg')
const res=await fetch(`https://storage.bunnycdn.com/${zone}/${path}`,{method:'PUT',headers:{AccessKey:key,'Content-Type':'image/jpeg'},body:buf})
if(!res.ok){ console.log('❌',res.status); process.exit(1) }
const url=`${cdn}/${path}`; console.log('✓',url)
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='pourquoi-detester-fast-fashion'){ a.cover=url; console.log('✓ cover màj') }
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
