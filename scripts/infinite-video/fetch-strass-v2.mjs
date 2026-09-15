// Récupère les photos des sacs Strass Chronique (trigramme STRC) pour la v2.
// RÈGLE PHOTO : imageUrls[0] (1re photo de l'annonce), jamais photos.face.
// Écrit ~/Desktop/videos-ig-infinite/data/strass-v2.json { dispo, vendus }.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { config } from 'dotenv'
import { writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
config({ path: new URL('../../.env.local', import.meta.url).pathname })

if (!getApps().length) {
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }) })
}
const db = getFirestore()

// Plage SKU : startAt('STRC')/endAt('STRC￿') — sinon endAt('STRC') ne rend rien.
const snap = await db.collection('produits').orderBy('sku').startAt('STRC').endAt('STRC￿').get()

const dispo = [], vendus = []
for (const d of snap.docs) {
  const p = { id: d.id, ...d.data() }
  if (p.trigramme && p.trigramme.toUpperCase() !== 'STRC') continue
  if (p.statut === 'retour' || p.statut === 'supprime') continue   // sacs rendus
  const img = p.imageUrls?.[0]
  if (!img) continue
  const row = { sku: p.sku || p.id, nom: p.nom || '', img }
  ;(p.vendu ? vendus : dispo).push(row)
}
const dir = join(homedir(), 'Desktop', 'videos-ig-infinite', 'data')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'strass-v2.json'), JSON.stringify({ dispo, vendus }, null, 2))
console.log(`✓ ${dispo.length} dispo + ${vendus.length} vendus`)
console.log('dispo  :', dispo.map(r => `${r.sku} ${r.nom}`).join('\n         '))
console.log('vendus :', vendus.map(r => r.sku).join(', '))
