// Webhook qui reçoit les mails relayés par la Firebase Function de watch Gmail
// (fonction `gmailWatcherAchats` à ajouter dans functions/index.js).
//
// Détecte le type de mail (Vinted/Chronopost/Mondial Relay/Chronopost Pickup),
// appelle le parser approprié, puis :
//   - mail Vinted "Ton reçu" → crée un brouillon produit (chineuse NR)
//   - mail transporteur "en chemin" → ajoute le numéro de suivi au produit
//   - mail transporteur "disponible" → marque le produit comme livré
//
// Authentification simple via header X-Internal-Token (la Function doit poser
// le même token). Tous les writes Firestore sont déterministes (anti-doublon).

import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebaseAdmin'
import { parseVintedReceipt, vintedDocId } from '@/modules/achat/parser/vinted'
import { parseChronopostEnChemin } from '@/modules/achat/parser/chronopost'
import { parseMondialRelayDispo } from '@/modules/achat/parser/mondialRelay'
import { parseChronopostPickupDispo } from '@/modules/achat/parser/chronopostPickup'
import { buildVintedProduitPayload } from '@/modules/achat/payload'
import { ACHETEUSE_TRIGRAMME } from '@/lib/roles'
import { detectMarque } from '@/lib/marques'
import { detectModele } from '@/lib/modeles'
import { detectMotif } from '@/lib/motifs'
import { detectCategorieFromTitre, type CategorieEntry } from '@/modules/achat/detectCategorie'
import { ALL_MATIERES } from '@/lib/matieres'
import { COLOR_PALETTE } from '@/lib/couleurs'

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

  const { gmailMessageId, from, subject, body } = payload
  if (!body || !from) {
    return NextResponse.json({ error: 'missing from/body' }, { status: 400 })
  }

  try {
    // --- Vinted "Ton reçu" → création brouillon ---------------------------
    if (/vinted\.fr/i.test(from) && /Ton re[çc]u pour la commande/i.test(subject)) {
      return await handleVintedReceipt(body, gmailMessageId)
    }

    // --- Chronopost "en chemin" → ajout numéro de suivi -------------------
    if (/chronopost\.fr/i.test(from) && /en chemin/i.test(subject)) {
      return await handleCarrierTracking(body, 'chronopost')
    }

    // --- Mondial Relay (disponible ou redirigé) → livraison ---------------
    if (/mondialrelay\.fr/i.test(from)) {
      return await handleMondialRelay(body)
    }

    // --- Chronopost Pickup "arrivé en relais" → livraison -----------------
    if (/pickup\.fr/i.test(from)) {
      return await handleChronopostPickup(body)
    }

    return NextResponse.json({ ok: false, reason: 'unhandled mail type', from, subject })
  } catch (e: any) {
    console.error('gmail-achats webhook error:', e)
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
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
// Mail transporteur "en chemin" : on a juste le numéro de suivi, pas la ref
// Vinted. Heuristique : on attache au brouillon Vinted le plus récent en statut
// `commande` qui n'a pas encore de numéro de suivi. À sa réception du mail
// "expédié" Vinted (à parser plus tard), on pourra matcher proprement.
// ---------------------------------------------------------------------------
async function handleCarrierTracking(body: string, transporteur: 'chronopost') {
  const r = parseChronopostEnChemin(body)
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason })

  const target = await findVintedProduitSansSuivi()
  if (!target) {
    return NextResponse.json({ ok: false, reason: 'aucun brouillon Vinted commandé sans suivi', numeroSuivi: r.numeroSuivi })
  }

  await target.ref.update({
    achatStatut: 'expedie',
    achatNumeroSuivi: r.numeroSuivi,
    achatTransporteur: transporteur,
  })

  return NextResponse.json({ ok: true, docId: target.ref.id, kind: 'tracking-set', numeroSuivi: r.numeroSuivi })
}

// ---------------------------------------------------------------------------
// Mondial Relay : matching par numéro de colis avec achatNumeroSuivi.
// Si pas de match : on logge un warning (mail orphelin) mais on renvoie 200
// pour éviter les retries.
// ---------------------------------------------------------------------------
async function handleMondialRelay(body: string) {
  const r = parseMondialRelayDispo(body)
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason })

  const target = await findProduitByNumeroSuivi(r.numeroColis)
  if (!target) {
    return NextResponse.json({ ok: false, reason: 'aucun produit avec ce numéro de colis', numeroColis: r.numeroColis })
  }

  const updates: Record<string, unknown> = {
    achatTransporteur: 'mondial-relay',
    achatLieuLivraison: r.lieuLivraison,
  }
  if (r.kind === 'disponible') {
    updates.achatStatut = 'livre'
    updates.achatCodeRetrait = r.codeRetrait
    updates.achatDateLimiteRetrait = r.dateLimiteRetrait
    updates.achatDateLivraison = Timestamp.now()
  }
  // kind === 'redirige' : on met juste l'adresse, statut reste 'expedie'

  await target.ref.update(updates)

  return NextResponse.json({ ok: true, docId: target.ref.id, kind: `mondial-relay-${r.kind}` })
}

// ---------------------------------------------------------------------------
// Chronopost Pickup : matching par numéro de suivi (XW…).
// ---------------------------------------------------------------------------
async function handleChronopostPickup(body: string) {
  const r = parseChronopostPickupDispo(body)
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason })

  const target = await findProduitByNumeroSuivi(r.numeroSuivi)
  if (!target) {
    return NextResponse.json({ ok: false, reason: 'aucun produit avec ce numéro de suivi', numeroSuivi: r.numeroSuivi })
  }

  await target.ref.update({
    achatStatut: 'livre',
    achatTransporteur: 'chronopost-pickup',
    achatLieuLivraison: r.lieuLivraison,
    achatCodeRetrait: r.codeRetrait,
    achatDateLimiteRetrait: r.dateLimiteRetrait,
    achatDateLivraison: Timestamp.now(),
  })

  return NextResponse.json({ ok: true, docId: target.ref.id, kind: 'chronopost-pickup' })
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

async function findVintedProduitSansSuivi() {
  const snap = await adminDb
    .collection('produits')
    .where('source', '==', 'achat-vinted')
    .where('achatStatut', '==', 'commande')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get()
  for (const d of snap.docs) {
    if (!d.data().achatNumeroSuivi) return d
  }
  return null
}

async function findProduitByNumeroSuivi(numero: string) {
  const snap = await adminDb
    .collection('produits')
    .where('achatNumeroSuivi', '==', numero)
    .limit(1)
    .get()
  return snap.empty ? null : snap.docs[0]
}
