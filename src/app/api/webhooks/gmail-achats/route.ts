// Webhook qui reçoit les mails relayés par la Firebase Function de watch Gmail
// (fonction `gmailWatcherAchats` à ajouter dans functions/index.js).
//
// Détecte le type de mail Vinted, appelle le parser approprié, puis :
//   - mail Vinted "Ton reçu" → crée un brouillon produit (chineuse NR)
//   - mail Vinted "Nouveau message" → pose la photo de l'annonce sur la pièce
//
// Authentification simple via header X-Internal-Token (la Function doit poser
// le même token). Tous les writes Firestore sont déterministes (anti-doublon).

export const runtime = 'nodejs'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebaseAdmin'
import { sendPushToOwner } from '@/lib/webpush'
import sharp from 'sharp'
import { parseVintedReceipt, vintedDocId } from '@/modules/achat/parser/vinted'
import { buildVintedProduitPayload } from '@/modules/achat/payload'
import { ACHETEUSE_TRIGRAMME } from '@/lib/roles'
import { detectMarque } from '@/lib/marques'
import { detectModele } from '@/lib/modeles'
import { detectMotif } from '@/lib/motifs'
import { detectCategorieFromTitre, type CategorieEntry } from '@/modules/achat/detectCategorie'
import { ALL_MATIERES } from '@/lib/matieres'
import { COLOR_PALETTE } from '@/lib/couleurs'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Pré-remplit les champs secondaires d'une pièce achat à partir de son titre
 *  (mêmes détecteurs que le formulaire, appliqués à l'import auto). */
function detecterChampsDepuisTitre(titre: string, categories: CategorieEntry[]) {
  const t = norm(titre)
  const out: Record<string, string> = {}
  const cat = detectCategorieFromTitre(titre, categories)
  if (cat?.label) out.categorie = cat.label
  const marque = detectMarque(titre); if (marque) out.marque = marque
  const modele = detectModele(titre); if (modele) out.modele = modele
  const motif = detectMotif(titre); if (motif) out.motif = motif
  // Matière : première matière connue trouvée dans le titre (ex: "cuir" → Cuir)
  const mat = ALL_MATIERES.find(m => new RegExp(`\\b${norm(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(t))
  if (mat) out.material = mat
  // Couleur : première couleur de la palette trouvée dans le titre
  const col = COLOR_PALETTE.find(c => t.includes(norm(c.name)))
  if (col) out.color = col.name
  // Taille : "taille S", "taille 38"
  const tm = titre.match(/taille\s+([A-Za-z0-9]{1,4})/i)
  if (tm) out.taille = tm[1].toUpperCase()
  return out
}

type Payload = {
  gmailMessageId: string
  from: string
  subject: string
  body: string
  /** `alerte-token` : la Function n'arrive plus à lire la boîte achats. */
  kind?: 'alerte-token'
  detail?: string
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-internal-token') !== process.env.NR_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // --- Alerte "je ne peux plus lire la boîte achats" ----------------------
  // L'autorisation Gmail de nouvelleriveachats@ peut sauter (révocation). Sans
  // alerte, le poll échoue en silence et plus aucun achat n'entre : c'est ce
  // qui a coûté un mois d'imports. Push 1×/jour max pour ne pas spammer.
  if (payload.kind === 'alerte-token') {
    return await handleAlerteToken(payload.detail || '')
  }

  const { gmailMessageId, from, subject, body } = payload
  if (!body || !from) {
    return NextResponse.json({ error: 'missing from/body' }, { status: 400 })
  }

  try {
    // --- Vinted "Ton reçu" → création brouillon ---------------------------
    if (/vinted\.fr/i.test(from) && /Ton re[çc]u pour la commande/i.test(subject)) {
      return await handleVintedReceipt(body, gmailMessageId)
    }

    // --- Vinted "Nouveau message" → photo de la pièce ---------------------
    // Le reçu n'a ni photo ni lien : c'est le mail de conversation qui porte
    // le lien de l'annonce, donc la seule photo récupérable sans navigateur.
    if (/vinted\.fr/i.test(from) && /Nouveau message à propos de/i.test(subject)) {
      return await handleVintedPhoto(body, subject)
    }

    // Mail d'un expéditeur suivi mais dont on n'a rien à tirer (évaluation,
    // offre, baisse de prix…). `rienAFaire` dit au poll de le marquer lu quand
    // même : sinon il serait re-téléchargé toutes les 5 min à vie.
    return NextResponse.json({ ok: false, rienAFaire: true, reason: 'unhandled mail type', from, subject })
  } catch (e: any) {
    console.error('gmail-achats webhook error:', e)
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Alerte panne de lecture de la boîte achats : push à la boutique, 1×/jour max
// (le poll tourne toutes les 5 min, on ne veut pas 288 notifs).
// ---------------------------------------------------------------------------
async function handleAlerteToken(detail: string) {
  const ref = adminDb.collection('siteConfig').doc('_achatAlerte')
  const snap = await ref.get()
  const dernier = snap.data()?.tokenAlerteLe?.toDate?.() as Date | undefined
  if (dernier && Date.now() - dernier.getTime() < 20 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: true, kind: 'alerte-token-throttle' })
  }

  await sendPushToOwner('boutique', {
    title: '⚠️ Achats Vinted à l’arrêt',
    body: 'La boîte achats n’est plus lisible : aucun achat ne rentre. Il faut réautoriser Gmail.',
    url: '/acheteuse/mes-produits',
    tag: 'achat-token-ko',
  })
  await ref.set({ tokenAlerteLe: Timestamp.now(), tokenAlerteDetail: detail.slice(0, 300) }, { merge: true })

  return NextResponse.json({ ok: true, kind: 'alerte-token-envoyee' })
}

// ---------------------------------------------------------------------------
// Vinted "Ton reçu" : crée un nouveau brouillon produit sous chineuse NR.
// ID Firestore déterministe = `vinted_${transactionId}` → si on re-parse le même
// mail, on écrit le même doc (pas de doublon).
// ---------------------------------------------------------------------------
async function handleVintedReceipt(body: string, gmailMessageId: string) {
  const receipt = parseVintedReceipt(body)
  if (!receipt.ok) {
    return NextResponse.json({ ok: false, reason: receipt.reason })
  }

  // Pièce déjà importée → on ne réécrit rien. Le `set(merge)` plus bas
  // écraserait les retouches faites depuis (nom, prix, photos) et brûlerait un
  // SKU au passage. Réponse ok:true pour que le rejeu d'un mail soit sans
  // risque (rattrapage, retry, mail relu à la main).
  const dejaLa = await adminDb.collection('produits').doc(vintedDocId(receipt.transactionId)).get()
  if (dejaLa.exists) {
    return NextResponse.json({
      ok: true,
      docId: dejaLa.id,
      sku: dejaLa.data()?.sku,
      kind: 'vinted-receipt-deja-importe',
    })
  }

  // La boîte achats = l'acheteuse → pièces rattachées au trigramme ACH (marge
  // et commission isolées). Fallback NR si le doc ACH n'existe pas encore.
  let chineuse = await findChineuse(ACHETEUSE_TRIGRAMME)
  let trigramme = ACHETEUSE_TRIGRAMME
  if (!chineuse) {
    chineuse = await findChineuse('NR')
    trigramme = 'NR'
  }
  if (!chineuse) {
    return NextResponse.json({ ok: false, reason: 'chineuse ACH/NR introuvable' }, { status: 500 })
  }

  const sku = await computeNextSku(trigramme)
  const payload = buildVintedProduitPayload(receipt, { chineuseNR: chineuse, sku, trigramme })
  const docId = vintedDocId(receipt.transactionId)

  // Pré-remplissage des champs secondaires depuis le titre (catégorie ACH,
  // marque, modèle, motif, matière, couleur, taille) — comme l'import manuel.
  const champs = detecterChampsDepuisTitre(receipt.titre, chineuse.categories)

  await adminDb.collection('produits').doc(docId).set(
    {
      ...payload,
      ...champs,
      createdAt: Timestamp.fromDate(payload.createdAt),
      achatDateCommande: Timestamp.fromDate(payload.achatDateCommande),
      achatGmailMessageId: gmailMessageId,
    },
    { merge: true }
  )

  return NextResponse.json({ ok: true, docId, sku, kind: 'vinted-receipt' })
}

// ---------------------------------------------------------------------------
// Vinted "Nouveau message à propos de …" : ce mail contient un lien
// links.vinted.com/t/<base64> dont le base64 encode l'id de l'annonce. On en
// tire la vraie photo (og:image), on la passe en carré et on la pose sur la
// pièce correspondante — juste pour savoir de quelle pièce on parle, les
// photos définitives sont refaites ensuite.
// ---------------------------------------------------------------------------
async function handleVintedPhoto(body: string, subject: string) {
  const itemId = extraireItemId(body)
  const sujetTitre = subject.replace(/^Nouveau message à propos de\s*/i, '').trim()
  if (!itemId) return NextResponse.json({ ok: false, rienAFaire: true, reason: 'pas de lien annonce' })

  // Pièce achat Vinted sans photo dont le titre colle au sujet du mail.
  const snap = await adminDb.collection('produits').where('source', '==', 'achat-vinted').get()
  const candidates = snap.docs.filter(d => {
    const p = d.data()
    const aPhoto = p.photos?.face || (Array.isArray(p.imageUrls) && p.imageUrls.length) || p.imageUrl
    return !aPhoto && collePresque(p.achatTitreOriginal || p.nom || '', sujetTitre)
  })
  if (candidates.length !== 1) {
    return NextResponse.json({ ok: false, rienAFaire: true, reason: `${candidates.length} pièce(s) sans photo pour « ${sujetTitre} »` })
  }
  const doc = candidates[0]
  const titrePiece = doc.data().achatTitreOriginal || doc.data().nom || ''

  const page = await fetch(`https://www.vinted.fr/items/${itemId}`, { headers: { 'User-Agent': UA } })
  if (!page.ok) return NextResponse.json({ ok: false, rienAFaire: true, reason: `annonce ${itemId} ${page.status}` })
  const html = await page.text()
  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]
  const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]
  if (!ogImage) return NextResponse.json({ ok: false, rienAFaire: true, reason: 'pas de og:image' })
  // Garde-fou : une annonce nommée « Veste » ne doit pas atterrir sur la
  // première veste sans photo venue.
  if (ogTitle && !recoupeTitres(titrePiece, ogTitle)) {
    return NextResponse.json({ ok: false, rienAFaire: true, reason: `titre annonce « ${ogTitle} » ≠ « ${titrePiece} »` })
  }

  const cdn = await posePhotoCarree(doc.id, ogImage)
  if (!cdn) return NextResponse.json({ ok: false, reason: 'upload photo échoué' })

  const cur = doc.data()
  await doc.ref.set({
    photos: { ...(cur.photos || {}), details: [...(cur.photos?.details || []), cdn] },
    imageUrls: [cdn, ...(Array.isArray(cur.imageUrls) ? cur.imageUrls : [])],
    imageUrl: cur.imageUrl || cdn,
    achatAnnonceUrl: `https://www.vinted.fr/items/${itemId}`,
  }, { merge: true })

  return NextResponse.json({ ok: true, docId: doc.id, sku: cur.sku, kind: 'vinted-photo' })
}

/** Id de l'annonce caché dans les liens de tracking Vinted du mail. */
function extraireItemId(body: string): string | null {
  for (const m of body.matchAll(/https:\/\/links\.vinted\.com\/t\/([A-Za-z0-9_\-=]+)/g)) {
    try {
      const url = Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
      const id = url.match(/item\?id=(\d+)/)
      if (id) return id[1]
    } catch { /* lien non décodable : on passe au suivant */ }
  }
  return null
}

/** Le sujet du mail tronque le titre au milieu (« Vintage vis..ne »). */
function collePresque(titrePiece: string, sujet: string): boolean {
  const t = norm(titrePiece), s = norm(sujet)
  if (!t || !s) return false
  if (t.includes(s) || s.includes(t)) return true
  const [avant, apres] = sujet.split('..').map(norm)
  return !!avant && avant.length >= 4 && t.startsWith(avant.slice(0, 18)) && (!apres || t.endsWith(apres))
}

/** Même pièce ? 2 mots de 4+ lettres en commun (1 seul si les deux titres
 *  tiennent en un mot, ex. « Lancel. »). Le og:title Vinted finit par
 *  « | Vinted », qu'on retire avant de comparer. */
function recoupeTitres(a: string, b: string): boolean {
  const mots = (s: string) => new Set(norm(s.replace(/\s*\|\s*vinted\s*$/i, '')).split(' ').filter(w => w.length >= 4))
  const A = mots(a), B = mots(b)
  if (!A.size || !B.size) return false
  let communs = 0
  for (const w of A) if (B.has(w)) communs++
  if (communs === 0) return false
  if (A.size === 1 || B.size === 1) return A.size <= 2 && B.size <= 2
  return communs >= 2 && communs / Math.min(A.size, B.size) >= 0.5
}

/** Télécharge, recadre en carré (photo non détourée → cover) et héberge sur
 *  Bunny. Renvoie l'URL CDN, ou null si un maillon manque. */
async function posePhotoCarree(docId: string, srcUrl: string): Promise<string | null> {
  const zone = process.env.BUNNY_STORAGE_ZONE
  const key = process.env.BUNNY_API_KEY
  const cdnBase = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
  if (!zone || !key || !cdnBase) return null

  const img = await fetch(srcUrl, { headers: { 'User-Agent': UA } })
  if (!img.ok) return null
  const carre = await sharp(Buffer.from(await img.arrayBuffer()))
    .resize(1200, 1200, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 88 })
    .toBuffer()

  const path = `produits/${docId}_achat_${Date.now()}.jpg`
  const put = await fetch(`https://storage.bunnycdn.com/${zone}/${path}`, {
    method: 'PUT', headers: { AccessKey: key, 'Content-Type': 'image/jpeg' }, body: carre,
  })
  return put.ok ? `${cdnBase}/${path}` : null
}

// ---------------------------------------------------------------------------
// Helpers Firestore
// ---------------------------------------------------------------------------

async function findChineuse(trigramme: string): Promise<{ uid: string; email: string; categories: CategorieEntry[] } | null> {
  const snap = await adminDb.collection('chineuse').where('trigramme', '==', trigramme).limit(1).get()
  if (snap.empty) return null
  const d = snap.docs[0]
  const raw = d.data()['Catégorie']
  const categories: CategorieEntry[] = Array.isArray(raw)
    ? raw.map((c: any) => (typeof c === 'string' ? { label: c } : { label: c?.label, idsquare: c?.idsquare })).filter((c: CategorieEntry) => !!c.label)
    : []
  return { uid: d.id, email: d.data().email || '', categories }
}

async function computeNextSku(trigramme: string): Promise<string> {
  const snap = await adminDb.collection('produits').where('trigramme', '==', trigramme).get()
  let maxNum = 0
  const re = new RegExp(`^${trigramme}(\\d+)$`)
  snap.docs.forEach((d) => {
    const sku = String(d.data().sku || '')
    const m = sku.match(re)
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
  })
  return `${trigramme}${maxNum + 1}`
}

