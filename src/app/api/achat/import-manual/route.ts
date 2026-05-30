// Route admin (temporaire) pour importer manuellement un mail Vinted /
// transporteur en collant son contenu depuis l'app. Utilisée pour traiter
// le backlog en attendant que le webhook Pub/Sub Gmail soit en place.
//
// Auth : ID token Firebase de l'admin (vérifié par firebase-admin).
//
// Détection du type de mail : par contenu (pas besoin de From/Subject).
// Réutilise les mêmes parsers + helpers Firestore que la route webhook.

import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { parseVintedReceipt, vintedDocId } from '@/modules/achat/parser/vinted'
import { parseChronopostEnChemin } from '@/modules/achat/parser/chronopost'
import { parseMondialRelayDispo } from '@/modules/achat/parser/mondialRelay'
import { parseChronopostPickupDispo } from '@/modules/achat/parser/chronopostPickup'
import { parseVintedPage, vintedPageDocId } from '@/modules/achat/parser/vintedPage'
import { buildVintedProduitPayload } from '@/modules/achat/payload'

const ADMIN_EMAILS = new Set(['nouvelleriveparis@gmail.com'])

export async function POST(req: NextRequest) {
  // --- Auth admin ---------------------------------------------------------
  const idToken = req.headers.get('authorization')?.replace(/^Bearer /i, '') || ''
  if (!idToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let email = ''
  try {
    const decoded = await adminAuth.verifyIdToken(idToken)
    email = (decoded.email || '').toLowerCase()
  } catch {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }
  if (!ADMIN_EMAILS.has(email)) {
    return NextResponse.json({ error: 'not admin' }, { status: 403 })
  }

  // --- Lecture du payload --------------------------------------------------
  let body = ''
  try {
    const json = await req.json()
    body = String(json?.body || '')
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.trim()) {
    return NextResponse.json({ error: 'body vide' }, { status: 400 })
  }

  // --- Détection par contenu + dispatch ------------------------------------
  try {
    // Page Vinted (annonce produit) collée → priorité car contient plus d'infos
    // (marque/taille/couleur/état/description) que le mail "Ton reçu".
    if (/vinted\.fr\/items\//i.test(body) || /Inclut la Protection acheteurs/i.test(body)) {
      return await handleVintedPage(body)
    }
    if (/Re[çc]u pour votre commande Vinted/i.test(body) || /Votre paiement a [ée]t[ée] re[çc]u/i.test(body)) {
      return await handleVintedReceipt(body)
    }
    if (/colis\s+[A-Z0-9]{8,20}\s+est en chemin/i.test(body)) {
      return await handleCarrierTracking(body)
    }
    if (/sera\s+(?:finalement\s+)?livr[ée]\s+(?:dans\s+un\s+autre\s+Point\s+Relais|à\s+cette\s+adresse)/i.test(body)
        || /est\s+disponible/i.test(body) && /POINT\s*RELAIS/i.test(body)) {
      return await handleMondialRelay(body)
    }
    if (/Pickup\s+Pass/i.test(body) || /arriv[ée]\s+en\s+relais\s+Pickup/i.test(body)) {
      return await handleChronopostPickup(body)
    }
    return NextResponse.json({ ok: false, reason: 'type de mail non reconnu' }, { status: 400 })
  } catch (e: any) {
    console.error('import-manual error:', e)
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Mêmes handlers que la route webhook /api/webhooks/gmail-achats. Duplication
// volontaire et minimale : ces 4 fonctions disparaîtront en même temps que
// cette route quand le webhook Pub/Sub aura validé le backlog.
// ---------------------------------------------------------------------------

async function handleVintedPage(body: string) {
  const page = parseVintedPage(body)
  if (!page.ok) return NextResponse.json({ ok: false, reason: page.reason })

  const nrChineuse = await findChineuseNR()
  if (!nrChineuse) return NextResponse.json({ ok: false, reason: 'chineuse NR introuvable' }, { status: 500 })

  // ID déterministe via itemId si dispo, sinon doc créé sans ID (laissera doublon possible).
  const docId = page.itemId ? vintedPageDocId(page.itemId) : null
  const sku = await computeNextSkuNR()

  const payload: Record<string, unknown> = {
    nom: `${sku} - ${page.titre || 'Pièce Vinted'}`,
    description: page.description || '',
    categorie: '',
    marque: page.marque && page.marque.toLowerCase() !== 'inconnu' ? page.marque : '',
    taille: page.taille || '',
    color: page.couleur || null,
    etat: page.etat || '',
    sku,
    trigramme: 'NR',
    chineurUid: nrChineuse.uid,
    chineur: nrChineuse.email,
    imageUrls: [],
    imageUrl: '',
    photosReady: false,
    vendu: false,
    recu: false,
    quantite: 1,
    createdAt: Timestamp.now(),
    // Champs achat : on n'a pas de transactionId tant que le mail "Ton reçu"
    // n'est pas arrivé. On stocke prixArticle (côte achat brut) et prixAvecProtection
    // séparément. prixAchat = total payé = prixAvecProtection + port (le port n'est
    // pas dans la page, on le mettra à jour quand le mail arrivera).
    ...(page.prixAvecProtection !== null ? { prixAchat: page.prixAvecProtection } : {}),
    source: 'achat-vinted',
    achatProvenance: 'vinted',
    achatStatut: 'commande',
    achatVendeur: page.vendeur || '',
    achatTitreOriginal: page.titre || '',
    ...(page.itemId ? { achatVintedItemId: page.itemId } : {}),
    ...(page.url ? { achatAnnonceUrl: page.url } : {}),
  }

  if (docId) {
    await adminDb.collection('produits').doc(docId).set(payload, { merge: true })
    return NextResponse.json({ ok: true, docId, sku, kind: 'vinted-page' })
  }
  const ref = await adminDb.collection('produits').add(payload)
  return NextResponse.json({ ok: true, docId: ref.id, sku, kind: 'vinted-page-no-itemid' })
}

async function handleVintedReceipt(body: string) {
  const receipt = parseVintedReceipt(body)
  if (!receipt.ok) return NextResponse.json({ ok: false, reason: receipt.reason })

  const nrChineuse = await findChineuseNR()
  if (!nrChineuse) return NextResponse.json({ ok: false, reason: 'chineuse NR introuvable' }, { status: 500 })

  const sku = await computeNextSkuNR()
  const payload = buildVintedProduitPayload(receipt, { chineuseNR: nrChineuse, sku })
  const docId = vintedDocId(receipt.transactionId)

  await adminDb.collection('produits').doc(docId).set(
    {
      ...payload,
      createdAt: Timestamp.fromDate(payload.createdAt),
      achatDateCommande: Timestamp.fromDate(payload.achatDateCommande),
    },
    { merge: true }
  )

  return NextResponse.json({ ok: true, docId, sku, kind: 'vinted-receipt' })
}

async function handleCarrierTracking(body: string) {
  const r = parseChronopostEnChemin(body)
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason })

  const target = await findVintedProduitSansSuivi()
  if (!target) {
    return NextResponse.json({ ok: false, reason: 'aucun brouillon Vinted commandé sans suivi', numeroSuivi: r.numeroSuivi })
  }
  await target.ref.update({
    achatStatut: 'expedie',
    achatNumeroSuivi: r.numeroSuivi,
    achatTransporteur: 'chronopost',
  })
  return NextResponse.json({ ok: true, docId: target.ref.id, kind: 'tracking-set', numeroSuivi: r.numeroSuivi })
}

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
  await target.ref.update(updates)
  return NextResponse.json({ ok: true, docId: target.ref.id, kind: `mondial-relay-${r.kind}` })
}

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
// Helpers Firestore (dupliqués de la route webhook).
// ---------------------------------------------------------------------------

async function findChineuseNR(): Promise<{ uid: string; email: string } | null> {
  const snap = await adminDb.collection('chineuse').where('trigramme', '==', 'NR').limit(1).get()
  if (snap.empty) return null
  const d = snap.docs[0]
  return { uid: d.id, email: d.data().email || '' }
}

async function computeNextSkuNR(): Promise<string> {
  const snap = await adminDb.collection('produits').where('trigramme', '==', 'NR').get()
  let maxNum = 0
  snap.docs.forEach((d) => {
    const sku = String(d.data().sku || '')
    const m = sku.match(/^NR(\d+)$/)
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
  })
  return `NR${maxNum + 1}`
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
