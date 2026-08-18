import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get(); const articles=snap.data().articles
const ETYMO = `D'où vient le mot ? On raconte souvent qu'il viendrait de « vingt-age », soit vingt ans d'âge : jolie histoire, mais c'est un mythe, et le sujet fait débat. En réalité, « vintage » vient du vocabulaire du vin — de l'ancien français « vendange » (la récolte du raisin, du latin vindemia). Il a d'abord désigné le millésime d'un grand cru, puis, vers la fin du XIXe siècle (autour de 1883), tout ce qui « date d'une époque révolue ». Ce n'est qu'au XXe siècle qu'on l'a appliqué aux vêtements et aux objets de collection.

`
for(const a of articles) if(a.slug==='vintage-upcycle-regenere-difference'){
  if(!a.body.includes('vingt-age')){ const i=a.body.indexOf('## Seconde main'); if(i>-1){ a.body=a.body.slice(0,i)+ETYMO+a.body.slice(i); console.log('✓ étymologie insérée') } }
  a.sources=[
    { label: 'Etymonline — Vintage (étymologie)', url: 'https://www.etymonline.com/word/vintage' },
    { label: 'Merriam-Webster — Vintage', url: 'https://www.merriam-webster.com/dictionary/vintage' },
  ]
  console.log('✓ sources ajoutées')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
