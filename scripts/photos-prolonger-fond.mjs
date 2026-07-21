// ─────────────────────────────────────────────────────────────────────────────
// PHOTOS — PROLONGER LE FOND JUSQU'AUX BORDS DU CARRÉ
//
// À QUOI ÇA SERT
//   Une photo verticale mise au carré laisse deux zones vides à gauche et à
//   droite du sujet. Ce script les remplit avec le fond de la photo elle-même :
//   il prend une colonne de fond juste à côté du sujet et l'étire jusqu'au bord.
//   Le dégradé du mur et l'ombre au sol continuent, il ne reste aucune bande
//   blanche. Le sujet n'est jamais recadré ni déplacé.
//
// QUAND LE RELANCER
//   Après un lot de nouvelles fiches, ou si des photos anciennes montrent encore
//   des côtés vides. Le script est idempotent : une photo déjà pleine bord à
//   bord est ignorée, on peut le relancer sans risque.
//
// UTILISATION
//   node scripts/photos-prolonger-fond.mjs --dry            # simulation, n'écrit rien
//   node scripts/photos-prolonger-fond.mjs                  # tout le catalogue + iconiques
//   node scripts/photos-prolonger-fond.mjs trench           # seulement les fiches "trench"
//   node scripts/photos-prolonger-fond.mjs --dry "trench|manteau"
//   node scripts/photos-prolonger-fond.mjs --marge-min=4 Pineau   # rattrape les petites marges
//   Le filtre est une expression régulière testée sur nom + catégorie + sous-catégorie.
//   TOUJOURS faire un --dry d'abord pour voir le volume concerné.
//
//   Puis, pour que le site serve les nouvelles images :
//     node scripts/cache-invalider.mjs produits-all iconiques
//     git commit --allow-empty -m "redeploy" && git push   # purge la mémoire des workers
//
// CE QU'IL NE TOUCHE PAS
//   - Les photos dont la colonne de fond n'est pas lisse (intérieur, meuble,
//     plinthe) : les étirer ferait des traînées, elles restent intactes.
//   - Les photos déjà pleines bord à bord.
//   - Les fichiers d'origine : chaque correction est un NOUVEAU fichier sur
//     Bunny, l'ancienne URL reste en place. Tout est réversible.
//
// COÛT
//   La liste des produits vient du cache blob, donc zéro lecture Firestore pour
//   le parcours. Seules les fiches réellement modifiées sont relues puis écrites.
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

const DRY = process.argv.includes('--dry')
// Marge minimale (en px) à partir de laquelle on comble. Par défaut 20, pour ne
// pas retoucher une photo déjà quasi pleine ; baisser (ex --marge-min=4) pour
// rattraper les toutes petites marges résiduelles.
const MARGE_MIN = Number(process.argv.find(a => a.startsWith('--marge-min='))?.split('=')[1] || 20)

if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })

const db = getFirestore()

// Étire le fond vers les deux bords d'UN axe (horizontal = colonnes, vertical =
// lignes). Renvoie { buffer, avant, apres } si quelque chose a été comblé, sinon null.
async function etendreAxe(buf, axe) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, ch = info.channels
  // N = nombre de tranches sur l'axe traité, M = longueur d'une tranche.
  const horizontal = axe === 'h'
  const N = horizontal ? W : H
  const M = horizontal ? H : W
  const idx = (n, m) => (horizontal ? (m * W + n) : (n * W + m)) * ch

  // La marge à combler est une bordure uniformément blanche (padding). On étire
  // le fond réel qui commence juste après. Une tranche est "bord blanc" si tous
  // ses pixels sont quasi blancs (>= 249).
  const bordBlanc = n => { for (let m = 0; m < M; m++) { const i = idx(n, m); if (data[i] < 249 || data[i+1] < 249 || data[i+2] < 249) return false } return true }
  let n0 = 0; while (n0 < N && bordBlanc(n0)) n0++
  let n1 = N - 1; while (n1 > n0 && bordBlanc(n1)) n1--
  if (n0 >= n1) return null // image entièrement blanche

  const margeAvant = n0                 // largeur de la bordure blanche avant
  const refApres = n1                   // dernière tranche de fond réel
  const margeApres = N - 1 - n1         // largeur de la bordure blanche après
  if (margeAvant < MARGE_MIN && margeApres < MARGE_MIN) return null

  // Bornes de contenu sur l'axe perpendiculaire : on ignore la bordure blanche de
  // cet axe, sinon une tranche de bord (gris) contiendrait aussi les coins blancs
  // et paraîtrait « non lisse ». Les coins seront comblés par le second passage.
  const bordBlancPerp = m => { for (let n = 0; n < N; n++) { const i = idx(n, m); if (data[i] < 249 || data[i+1] < 249 || data[i+2] < 249) return false } return true }
  let m0 = 0; while (m0 < M && bordBlancPerp(m0)) m0++
  let m1 = M - 1; while (m1 > m0 && bordBlancPerp(m1)) m1--
  const mLen = m1 - m0 + 1

  // La tranche étirée doit être un fond lisse : sinon (photo d'intérieur, décor)
  // l'étirement ferait des traînées, on laisse l'image intacte.
  const trancheLisse = n => {
    let ecartMax = 0
    for (let m = m0 + 1; m <= m1; m++) {
      const i = idx(n, m), j = idx(n, m - 1)
      ecartMax = Math.max(ecartMax, Math.abs(data[i] - data[j]), Math.abs(data[i+1] - data[j+1]), Math.abs(data[i+2] - data[j+2]))
    }
    return ecartMax <= 50
  }
  if (margeAvant >= MARGE_MIN && !trancheLisse(margeAvant)) return null
  if (margeApres >= MARGE_MIN && !trancheLisse(refApres)) return null

  // Déjà comblée ? Si la marge reproduit déjà la tranche de fond voisine, rien à
  // faire — sans ce test on retraiterait sans fin une photo dont le sujet ne
  // touche pas le bord.
  const memeQueTranche = (nDebut, nFin, nRef) => {
    for (let m = m0; m <= m1; m += 7) {
      const ref = idx(nRef, m)
      for (let n = nDebut; n <= nFin; n += 13) {
        const i = idx(n, m)
        if (Math.abs(data[i] - data[ref]) > 3 || Math.abs(data[i+1] - data[ref+1]) > 3 || Math.abs(data[i+2] - data[ref+2]) > 3) return false
      }
    }
    return true
  }
  const avantFait = margeAvant < MARGE_MIN || memeQueTranche(0, margeAvant - 1, margeAvant)
  const apresFait = margeApres < MARGE_MIN || memeQueTranche(refApres + 1, N - 1, refApres)
  if (avantFait && apresFait) return null

  // On n'étire que la portion de contenu (hauteur mLen à partir de m0) ; les
  // bandes blanches perpendiculaires restent, comblées par le passage suivant.
  const pieces = []
  if (margeAvant >= MARGE_MIN) {
    const region = horizontal
      ? { left: margeAvant, top: m0, width: 1, height: mLen }
      : { left: m0, top: margeAvant, width: mLen, height: 1 }
    const taille = horizontal ? { width: margeAvant, height: mLen } : { width: mLen, height: margeAvant }
    const pos = horizontal ? { left: 0, top: m0 } : { left: m0, top: 0 }
    pieces.push({ input: await sharp(buf).extract(region).resize({ ...taille, fit: 'fill' }).toBuffer(), ...pos })
  }
  if (margeApres >= MARGE_MIN) {
    const region = horizontal
      ? { left: refApres, top: m0, width: 1, height: mLen }
      : { left: m0, top: refApres, width: mLen, height: 1 }
    const taille = horizontal ? { width: margeApres, height: mLen } : { width: mLen, height: margeApres }
    const pos = horizontal ? { left: refApres + 1, top: m0 } : { left: m0, top: refApres + 1 }
    pieces.push({ input: await sharp(buf).extract(region).resize({ ...taille, fit: 'fill' }).toBuffer(), ...pos })
  }
  if (!pieces.length) return null
  return {
    avant: margeAvant, apres: margeApres,
    buffer: await sharp(buf).composite(pieces).flatten({ background: { r: 255, g: 255, b: 255 } }).png().toBuffer(),
  }
}

// Comble le fond sur les 4 côtés : d'abord gauche/droite, puis haut/bas sur le
// résultat (les tranches horizontales étirées remplissent alors aussi les coins).
async function prolongerFond(buf) {
  const zone = {}
  let courant = buf
  const h = await etendreAxe(courant, 'h')
  if (h) { courant = h.buffer; zone.gauche = h.avant; zone.droite = h.apres }
  const v = await etendreAxe(courant, 'v')
  if (v) { courant = v.buffer; zone.haut = v.avant; zone.bas = v.apres }
  if (!h && !v) return null
  return { zone, buffer: courant }
}

async function upload(buffer) {
  const path = `produits/conserved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`
  const res = await fetch(`https://storage.bunnycdn.com/${process.env.BUNNY_STORAGE_ZONE}/${path}`, {
    method: 'PUT',
    headers: { AccessKey: process.env.BUNNY_API_KEY, 'Content-Type': 'image/png' },
    body: buffer,
  })
  if (!res.ok) throw new Error('upload Bunny ' + res.status)
  return `${process.env.NEXT_PUBLIC_BUNNY_CDN_URL}/${path}`
}

async function traiter(urls) {
  const mapping = new Map()
  for (const url of urls) {
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const fixed = await prolongerFond(Buffer.from(await r.arrayBuffer()))
      if (!fixed) continue
      console.log('   ', fixed.zone)
      mapping.set(url, DRY ? url : await upload(fixed.buffer))
    } catch (e) {
      console.warn('    erreur', e.message)
    }
  }
  return mapping
}

// --- Iconiques ---
const icoSnap = await db.collection('iconiques').get()
for (const doc of icoSnap.docs) {
  const images = doc.data().images || []
  console.log(`iconique ${doc.data().slug} — ${images.length} images`)
  const map = await traiter(images)
  if (map.size && !DRY) await doc.ref.update({ images: images.map(u => map.get(u) || u) })
  console.log(`  ${map.size} prolongées`)
}

// --- Produits (liste depuis le cache blob, gratuit) ---
const [blob] = await getStorage().bucket().file('_cache/produits-all.json.gz').download()
const raw = blob[0] === 0x1f && blob[1] === 0x8b ? gunzipSync(blob) : blob
const parsed = JSON.parse(raw.toString())
const tous = (Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray))
  .map(e => (e && e.raw ? { id: e.id, ...e.raw } : e))
const filtre = process.argv.slice(2).find(a => !a.startsWith('--'))
const produits = filtre
  ? tous.filter(p => new RegExp(filtre, 'i').test(`${p.nom || ''} ${p.categorie || ''} ${p.sousCategorie || ''}`))
  : tous
console.log(`${produits.length} produits à traiter${filtre ? ` (filtre "${filtre}")` : ''}`)

let total = 0
for (const p of produits) {
  const urls = [...new Set([
    p.photos?.face, p.photos?.dos, p.photos?.faceOnModel, p.photos?.dosOnModel,
    ...(p.photos?.details || []), ...(p.imageUrls || []), p.imageUrl,
  ].filter(Boolean))]
  const map = await traiter(urls)
  if (!map.size) continue
  console.log(`  ${p.sku} — ${map.size} prolongées`)
  total += map.size
  if (DRY) continue
  const ref = db.collection('produits').doc(p.id)
  const snap = await ref.get()
  if (!snap.exists) continue
  const cur = snap.data()
  const sub = u => (u ? map.get(u) || u : u)
  const update = {}
  if (cur.photos) update.photos = {
    ...cur.photos,
    ...(cur.photos.face ? { face: sub(cur.photos.face) } : {}),
    ...(cur.photos.dos ? { dos: sub(cur.photos.dos) } : {}),
    ...(cur.photos.faceOnModel ? { faceOnModel: sub(cur.photos.faceOnModel) } : {}),
    ...(cur.photos.dosOnModel ? { dosOnModel: sub(cur.photos.dosOnModel) } : {}),
    ...(cur.photos.details ? { details: cur.photos.details.map(sub) } : {}),
  }
  if (cur.imageUrls) update.imageUrls = cur.imageUrls.map(sub)
  if (cur.imageUrl) update.imageUrl = sub(cur.imageUrl)
  await ref.update(update)
}
console.log(`\n${total} photos produits prolongées${DRY ? ' (dry-run)' : ''}`)
