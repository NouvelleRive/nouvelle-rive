// Étape 1 du flow d'import achat : on parse le contenu collé (page Vinted ou
// mail Whatnot), on corrige l'ortho/grammaire via Claude, et on renvoie au
// front les champs structurés pour qu'il les affiche en formulaire de
// vérification (titre, marque, taille, couleur, état, description corrigée,
// catégorie auto-détectée, prix d'achat).
//
// L'écriture Firestore se fait dans un 2e appel à /api/achat/import-manual
// avec les champs validés/édités par l'admin (+ prix de vente).

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { parseVintedPage } from '@/modules/achat/parser/vintedPage'
import { parseWhatnotPurchase } from '@/modules/achat/parser/whatnot'
import { parseFleekInvoice } from '@/modules/achat/parser/fleek'
import { detectCategorieFromTitre, type CategorieEntry } from '@/modules/achat/detectCategorie'
import { mapTailleVintedVersNR } from '@/modules/achat/mapTaille'

const ADMIN_EMAILS = new Set(['nouvelleriveparis@gmail.com'])

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  // --- Auth ---------------------------------------------------------------
  const idToken = req.headers.get('authorization')?.replace(/^Bearer /i, '') || ''
  if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
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

  // --- Payload ------------------------------------------------------------
  let body = ''
  let targetChineuseUid = ''
  try {
    const json = await req.json()
    body = String(json?.body || '')
    targetChineuseUid = String(json?.targetChineuse?.uid || '')
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.trim()) return NextResponse.json({ error: 'body vide' }, { status: 400 })

  // --- Détection page Vinted ----------------------------------------------
  const looksLikeVintedPage =
    /Inclut la Protection acheteurs/i.test(body) ||
    /Protection acheteurs/i.test(body) ||
    /vinted\.fr\/items\//i.test(body) ||
    /Dressing du membre/i.test(body) ||
    /Articles similaires/i.test(body)

  if (looksLikeVintedPage) {
    const page = parseVintedPage(body)
    if (!page.ok) return NextResponse.json({ ok: false, reason: page.reason })

    // Fallback description : si le titre parsé est vide (page mal formatée),
    // la description contient souvent le nom de la pièce → utile pour la catégorie.
    const titreForCategorie = page.titre || page.description || ''
    const categorieEntry = await detectCategorie(targetChineuseUid, titreForCategorie)

    // Taille unique par défaut pour les bijoux : ils n'ont jamais de champ
    // "Taille" sur Vinted → sans ça la modal refuse la création.
    const bijouRe = /\b(collier|bague|bracelet|boucles?\s+d[.']?oreille|boucles?|broche|earcuff|charm|piercing|pendentif|sautoir)\b/i
    const isBijou = bijouRe.test(titreForCategorie)
    const tailleMappee = mapTailleVintedVersNR(page.taille || '')
    const tailleFinale = tailleMappee || (isBijou ? 'Unique' : '')

    const cleaned = await cleanWithClaude({
      titre: page.titre || '',
      description: page.description || '',
    })

    return NextResponse.json({
      ok: true,
      kind: 'vinted-page',
      fields: {
        provenance: 'vinted',
        itemId: page.itemId || null,
        titre: cleaned.titre,
        titreOriginal: page.titre || '',
        marque: page.marque && page.marque.toLowerCase() !== 'inconnu' ? page.marque : '',
        taille: tailleFinale,
        tailleOriginale: page.taille || '',
        couleur: page.couleur || '',
        etat: page.etat || '',
        description: cleaned.description,
        descriptionOriginale: page.description || '',
        vendeur: page.vendeur || '',
        prixAchat: page.prixAvecProtection ?? page.prixArticle ?? null,
        prixSuggere: (page.prixAvecProtection ?? page.prixArticle)
          ? Math.round((page.prixAvecProtection ?? page.prixArticle)! * 2.5)
          : null,
        categorie: categorieEntry,
        achatOrderId: null, // pas connu côté page
      },
    })
  }

  // --- Fleek (facture marketplace lots) ----------------------------------
  // Détection robuste avant Whatnot car Fleek a un format texte différent
  // (Order Number: #X, ligne "N / piece", aucun chevauchement avec Whatnot).
  if (/Fleek/i.test(body) && /Order\s*Number:\s*#?\s*\d+/i.test(body) && /\d+\s*\/\s*piece/i.test(body)) {
    const invoice = parseFleekInvoice(body)
    if (!invoice.ok) return NextResponse.json({ ok: false, reason: invoice.reason })

    const items = []
    for (const lot of invoice.lots) {
      const categorieEntry = await detectCategorie(targetChineuseUid, lot.titre)
      // Pas de cleanWithClaude ici : les titres Fleek sont génériques
      // ("Premium Ralph Lauren Polo Shirts") et seront retravaillés à la main
      // pièce par pièce après réception.
      items.push({
        provenance: 'fleek',
        achatOrderId: invoice.orderId,
        titre: lot.titre,
        titreOriginal: lot.titre,
        marque: '',
        taille: '',
        couleur: '',
        etat: '',
        description: '',
        descriptionOriginale: '',
        vendeur: 'Fleek',
        prixAchat: lot.prixUnitaire,
        prixSuggere: Math.round(lot.prixUnitaire * 2.5),
        categorie: categorieEntry,
        // Champs spécifiques Fleek pour la modal :
        quantiteLot: lot.qtyParLot,
        prixLot: lot.prixLot,
      })
    }

    return NextResponse.json({ ok: true, kind: 'fleek-invoice', items })
  }

  // --- Whatnot (1 mail = potentiellement plusieurs items) ----------------
  if (/Whatnot/i.test(body) && /Order\s*#\s*\d+/i.test(body)) {
    const purchase = parseWhatnotPurchase(body)
    if (!purchase.ok) return NextResponse.json({ ok: false, reason: purchase.reason })

    const items = []
    for (const it of purchase.items) {
      const categorieEntry = await detectCategorie(targetChineuseUid, it.titre)
      const cleaned = await cleanWithClaude({ titre: it.titre, description: '' })
      items.push({
        provenance: 'whatnot',
        achatOrderId: it.orderId,
        titre: cleaned.titre,
        titreOriginal: it.titre,
        marque: '',
        taille: '',
        couleur: '',
        etat: '',
        description: '',
        descriptionOriginale: '',
        vendeur: purchase.vendeur,
        prixAchat: it.prixTotal,
        prixSuggere: Math.round(it.prixTotal * 2.5),
        categorie: categorieEntry,
      })
    }

    return NextResponse.json({ ok: true, kind: 'whatnot-purchase', items })
  }

  return NextResponse.json({ ok: false, reason: 'contenu non reconnu' }, { status: 400 })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function detectCategorie(uid: string, titre: string): Promise<CategorieEntry | null> {
  if (!uid || !titre) return null
  try {
    const doc = await adminDb.collection('chineuse').doc(uid).get()
    if (!doc.exists) return null
    const data = doc.data() as any
    const raw = data?.['Catégorie'] || data?.categorie || []
    if (!Array.isArray(raw)) return null
    const cats = raw.map((c: any) => ({ label: c?.label, idsquare: c?.idsquare }))
    return detectCategorieFromTitre(titre, cats)
  } catch {
    return null
  }
}

/**
 * Corrige l'orthographe et la grammaire du titre + description via Claude.
 * Garde le sens et le ton, conserve le style sobre/élégant de NR.
 * En cas d'erreur API, retourne les textes d'origine (pas bloquant).
 */
async function cleanWithClaude(input: { titre: string; description: string }): Promise<{ titre: string; description: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { titre: input.titre, description: input.description }
  }
  if (!input.titre && !input.description) {
    return { titre: '', description: '' }
  }
  const prompt = `Tu es éditeur pour Nouvelle Rive, une boutique de mode vintage et seconde main premium. Style : sobre, élégant, jamais commercial ni emphatique.

Corrige l'orthographe et la grammaire des deux textes suivants. Ne traduis pas, ne reformule pas excessivement, garde le sens et le ton. Pour la description, retire les fautes et les expressions trop familières mais garde le côté authentique.

Réponds UNIQUEMENT en JSON, sans markdown, sans backticks :
{"titre": "...", "description": "..."}

TITRE original : ${JSON.stringify(input.titre || '')}
DESCRIPTION originale : ${JSON.stringify(input.description || '')}`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content
      .filter((c) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { titre: input.titre, description: input.description }
    const parsed = JSON.parse(jsonMatch[0])
    return {
      titre: typeof parsed.titre === 'string' ? parsed.titre : input.titre,
      description: typeof parsed.description === 'string' ? parsed.description : input.description,
    }
  } catch (e) {
    console.warn('cleanWithClaude failed, falling back to originals:', e)
    return { titre: input.titre, description: input.description }
  }
}
