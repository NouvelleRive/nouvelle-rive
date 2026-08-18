import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='reconnaitre-vrai-sac-luxe-vintage'){
  // extraire toutes les images de sacs (catalogue /produits/)
  const re=/^!\[([^\]]*)\]\((https:\/\/nouvellerive\.b-cdn\.net\/produits\/[^)]+)\)$/gm
  const imgs=[]; let m
  while((m=re.exec(a.body))!==null) imgs.push({alt:m[1],url:m[2]})
  console.log('images sacs trouvées dans le corps:',imgs.length)
  // retirer ces lignes (+ éventuelles lignes vides doublées)
  let b=a.body.replace(re,'').replace(/\n{3,}/g,'\n\n')
  // ajouter la couverture en tête du slider si pas déjà dedans
  const all=[]
  if(a.cover && a.cover.includes('/produits/')) all.push({alt:'Sac de luxe authentifié — NOUVELLE RIVE',url:a.cover})
  for(const im of imgs) if(!all.some(x=>x.url===im.url)) all.push(im)
  // construire le slider (lignes consécutives) et l'insérer après l'intro (avant "## 1.")
  const slider=all.map(x=>`![${x.alt}](${x.url})`).join('\n')
  if(!b.includes(all[1]?.url||'###') || true){
    const i=b.indexOf('## 1.')
    if(i>-1){ b=b.slice(0,i)+slider+'\n\n'+b.slice(i) }
  }
  a.body=b
  console.log('✓ slider de',all.length,'sacs inséré en haut')
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
