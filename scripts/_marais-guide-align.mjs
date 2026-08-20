import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const FR=[
  ["aux XVIe et XVIIe siècles","aux XVIIe et XVIIIe siècles"],
  ["Ambiance : concept stores, galeries d'art, archives de créateurs et vintage de luxe. Un Marais plus récent, tourné mode et design, où l'on chine sans fouiller.",
   "Ambiance : plus tranquille et décontractée, autour d'Arts et Métiers. Un Marais au rythme doux — cafés et restos cosy, concept stores, galeries d'art et vintage — parfait pour flâner sans se presser."],
]
const EN=[
  ["an aristocratic district in the 16th and 17th centuries","a playground for the French aristocracy in the 17th and 18th centuries"],
  ["The vibe: concept stores, art galleries, designer archives and luxury vintage. A more recent Marais, turned towards fashion and design, where you browse without digging.",
   "The vibe: more laid-back and relaxed, around Arts et Métiers — a chill Marais with cosy cafés and restaurants, concept stores, galleries and vintage, perfect for a slow stroll."],
]
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){
  for(const [o,n] of FR){ if(a.body?.includes(o)){ a.body=a.body.split(o).join(n); console.log('FR ok:',o.slice(0,35)) } else console.log('FR absent:',o.slice(0,35)) }
  for(const [o,n] of EN){ if(a.bodyEn?.includes(o)){ a.bodyEn=a.bodyEn.split(o).join(n); console.log('EN ok:',o.slice(0,35)) } else console.log('EN absent:',o.slice(0,35)) }
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
