// ─────────────────────────────────────────────────────────────────────────────
// CACHE — INVALIDER LES BLOBS
//
// À QUOI ÇA SERT
//   Le site lit les produits, les iconiques et les chineuses depuis des blobs
//   gzippés dans Firebase Storage (_cache/<clé>.json.gz), pas depuis Firestore.
//   Une modification faite en script n'invalide pas ces blobs : le site continue
//   de servir l'ancienne version jusqu'à expiration du TTL (6 h). Ce script les
//   supprime pour qu'ils soient régénérés au prochain chargement de page.
//
// UTILISATION
//   node scripts/cache-invalider.mjs                          # produits-all
//   node scripts/cache-invalider.mjs produits-all iconiques
//   Clés existantes : produits-all, iconiques, chineuses-lite, chineuses-full-admin
//
// ATTENTION
//   Les workers Vercel gardent aussi une copie en mémoire. Si la page affiche
//   encore l'ancienne version après invalidation, il faut un redéploiement pour
//   les redémarrer :  git commit --allow-empty -m "redeploy" && git push
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })

for (const key of process.argv.slice(2).length ? process.argv.slice(2) : ['produits-all']) {
  const file = getStorage().bucket().file(`_cache/${key}.json.gz`)
  const [exists] = await file.exists()
  if (!exists) { console.log(`${key} : déjà absent`); continue }
  await file.delete()
  console.log(`${key} : supprimé, sera régénéré au prochain chargement`)
}
