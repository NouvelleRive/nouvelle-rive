import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })
const PLACES=[
  ['NOUVELLE RIVE','8 rue des Écouffes 75004 Paris','fripe'],
  ['The Selection','The Selection vintage rue de Turenne Paris','fripe'],
  ['Anashi','Anashi vintage Paris 75003','fripe'],
  ['Nuovo','Nuovo boutique rue de Turenne Paris','fripe'],
  ['Kanelle Vintage','Kanelle Vintage Paris','fripe'],
  ['Revoir Vintage','Revoir Vintage rue Commines Paris','fripe'],
  ['The Parisian Vintage','rue Saint-Claude 75003 Paris','fripe'],
  ['KIS','rue de Bretagne 75003 Paris','fripe'],
  ['Antic Tonic','Antic Tonic Paris Marais','fripe'],
  ['Métro Saint-Paul','Métro Saint-Paul Paris','lieu'],
  ['Synagogue rue Pavée','10 rue Pavée 75004 Paris','lieu'],
  ['Rue des Rosiers','Rue des Rosiers Paris','lieu'],
  ['Musée Carnavalet','Musée Carnavalet Paris','lieu'],
  ['Place des Vosges','Place des Vosges Paris','lieu'],
  ['Hôtel de Ville','Hôtel de Ville Paris','lieu'],
  ["L'As du Fallafel",'34 rue des Rosiers 75004 Paris','food'],
  ['Fondation Alaïa','Fondation Azzedine Alaia rue de la Verrerie Paris','food'],
  ['Chez Anna','Chez Anna restaurant Marais Paris','food'],
  ['Marché des Enfants Rouges','Marché des Enfants Rouges 39 rue de Bretagne Paris','food'],
  ['Pasa Dena','Pasa Dena café Paris','cafe'],
  ['Joho','Joho café Paris Marais','cafe'],
  ['Merlot','Merlot café Haut Marais Paris','cafe'],
]
async function geo(q){
  const u=`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
  const r=await fetch(u,{headers:{'User-Agent':'nouvellerive-journal/1.0 (nouvelleriveparis)'}})
  const d=await r.json()
  return d[0]?{lat:+d[0].lat,lng:+d[0].lon}:null
}
const markers=[]
for(const [name,q,kind] of PLACES){
  const c=await geo(q)
  if(c){ markers.push({name,kind,lat:c.lat,lng:c.lng}); console.log('✓',name,c.lat.toFixed(4),c.lng.toFixed(4)) }
  else console.log('✗ ÉCHEC:',name)
  await new Promise(r=>setTimeout(r,1100))
}
console.log('\nTotal pins:',markers.length,'/',PLACES.length)
const db=getFirestore(); const ref=db.collection('siteConfig').doc('_journal')
const snap=await ref.get(); const articles=snap.data().articles
for(const a of articles) if(a.slug==='le-tour-des-fripes-ideal-dans-le-marais'){ a.mapMarkers=markers; console.log('✓ mapMarkers stockés') }
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
process.exit(0)
