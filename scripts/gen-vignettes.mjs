// Génère une vignette-image (1re frame) pour chaque contenu réseaux qui a une
// vidéo mais pas de vignette → pour que le feed l'affiche partout (iOS inclus).
import { execSync } from 'child_process'
import { createRequire } from 'node:module'
import { uploadBunny } from './lib/video-utils.mjs'
const require = createRequire('/Users/salomekassabi/Desktop/nouvelle-rive/functions/')
const admin = require('firebase-admin')
const sa = require('/Users/salomekassabi/Desktop/nouvelle-rive/functions/serviceAccountKey.json')
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) })
const db = admin.firestore()

const snap = await db.collection('reseauxContenu').get()
for (const d of snap.docs) {
  const x = d.data()
  if (!x.videoUrl || x.vignetteUrl || x.status === 'published') continue
  try {
    const out = `/tmp/vig-${d.id}.jpg`
    execSync(`ffmpeg -y -ss 0.5 -i "${x.videoUrl}" -frames:v 1 -vf "scale='min(1080,iw)':-2" -q:v 3 "${out}" -loglevel error`)
    const url = await uploadBunny(out, `reseaux/vignette/${d.id}-${Date.now()}.jpg`, 'image/jpeg')
    await d.ref.set({ vignetteUrl: url }, { merge: true })
    console.log(`✓ ${d.id} → ${url}`)
  } catch (e) {
    console.log(`✗ ${d.id}: ${(e.message || '').split('\n')[0].slice(0, 120)}`)
  }
}
console.log('Terminé.')
process.exit(0)
