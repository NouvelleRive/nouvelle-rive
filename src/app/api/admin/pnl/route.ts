// app/api/admin/pnl/route.ts
// P&L réel = la compta, pas nos estimations : on lit la balance générale
// Pennylane (comptes 6 = charges, 7 = produits) et les soldes bancaires des
// comptes agrégés. Admin uniquement, token Pennylane côté serveur seulement.
//
// GET ?start=YYYY-MM-DD&end=YYYY-MM-DD (défaut : exercice en cours)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { AggregateField, Timestamp } from 'firebase-admin/firestore'
import {
  getBankAccounts, getFiscalYears, getTrialBalance, getTransactions,
  getLedgerAccounts, getLignesDeComptes, getLedgerEntriesParIds, viderCacheTransactions,
  type TrialBalanceLine,
} from '@/lib/pennylane'
import { ventesSquare, fraisSquare } from '@/lib/squareVentes'
import { calcMargeNette } from '@/lib/marge'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

// Comptes agrégés dans Pennylane mais hors périmètre NR1 (compte séparé) :
// ils ne doivent pas entrer dans la trésorerie affichée.
const COMPTES_BANCAIRES_EXCLUS = [12660555776] // PRI

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!token) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded.email !== ADMIN_EMAIL) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    return null
  } catch {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }
}

// Postes du compte de résultat (plan comptable général), dans l'ordre de lecture.
// Un compte est rattaché au premier préfixe qui matche.
const POSTES: { cle: string; label: string; titre?: string; sens: 'produit' | 'charge'; prefixes: string[] }[] = [
  { cle: 'ventes', label: 'Ventes & commissions', sens: 'produit', prefixes: ['70'] },
  { cle: 'autresProduits', label: 'Autres produits', sens: 'produit', prefixes: ['71', '72', '74', '75', '78', '79'] },
  { cle: 'produitsFin', label: 'Produits financiers', sens: 'produit', prefixes: ['76'] },
  { cle: 'produitsExc', label: 'Produits exceptionnels', sens: 'produit', prefixes: ['77'] },

  { cle: 'marchandises', label: 'Achats de marchandises', sens: 'charge', prefixes: ['60'] },
  { cle: 'externes', label: 'Services extérieurs', sens: 'charge', prefixes: ['61', '62'] },
  { cle: 'impots', label: 'Impôts & taxes', sens: 'charge', prefixes: ['63'] },
  { cle: 'personnel', label: 'Charges de personnel', sens: 'charge', prefixes: ['64'] },
  { cle: 'autresCharges', label: 'Autres charges', sens: 'charge', prefixes: ['65'] },
  { cle: 'chargesFin', label: 'Charges financières', sens: 'charge', prefixes: ['66'] },
  // Les vols remboursés aux chineuses ont leur propre ligne.
  { cle: 'vols', label: 'Vols remboursés', sens: 'charge', prefixes: ['6718'] },
  { cle: 'chargesExc', label: 'Charges exceptionnelles', sens: 'charge', prefixes: ['67'] },
  { cle: 'amortissements', label: 'Amortissements & provisions', sens: 'charge', prefixes: ['68'] },
  { cle: 'is', label: 'Impôt sur les sociétés', sens: 'charge', prefixes: ['69'] },
]

// Dépôt-vente, modèle du comptable (exercice 2025) : les encaissements Square
// tombent dans un compte de transit (511301), les reversements aux chineuses
// dans un compte de tiers par chineuse (467xxx). Ni l'un ni l'autre n'est un
// produit ou une charge — seule la commission (706101) est du chiffre.
const POSTES_DEPOT_VENTE = [
  {
    cle: 'reversements',
    label: 'Reversements chineuses TTC',
    titre: 'Source : PENNYLANE — comptes 467xxx',
    prefixes: ['467'],
    sens: 'debit' as const,
  },
  {
    cle: 'tvaCommission',
    label: 'TVA collectée NR, en plus de la commission',
    titre: 'Source : PENNYLANE — compte 44574. Supportée par la chineuse, reversée à l’État par NR',
    prefixes: ['44574'],
    sens: 'credit' as const,
  },
]

// Le P&L ne bouge pas d'une minute à l'autre : on garde la réponse en mémoire
// du serveur et on ne retape Pennylane que sur demande (bouton « mettre à
// jour », ?refresh=1). Cache par instance, perdu au redéploiement, gratuit.
const CACHE = new Map<string, { le: number; corps: any }>()
const TTL_PNL = 30 * 24 * 60 * 60 * 1000

const ORDRE_BLOCS = ["Volume d'affaires", "Chiffre d'affaires", 'Charges variables']
const ORDRE_LIGNES = [
  'volume', 'volumeFacture', 'volumeMarchandises', 'ecart',
  'volumePrintemps', 'priVintage', 'priUpcycling',
  'volumeTotal', 'fraisSquareVolume', 'recuBanque',
  'commissions', 'tvaCommission', 'caMarchandises', 'caTotal',
  'caPrintemps', 'servicesPrintemps', 'caGlobal',
  'reversements', 'achatsMarchandises', 'coutVendu',
  'margeMarchandises', 'tvaSurMarge', 'margeMarchandisesHt',
]

const num = (v: string) => Number(v) || 0

// À quel poste appartient un compte : d'abord le dépôt-vente (467, 44574, 707
// hors ventes), puis le compte de résultat.
function posteDuCompte(n: string): { cle: string; sens: 'produit' | 'charge' | 'credit' | 'debit' } | null {
  const dv = POSTES_DEPOT_VENTE.find(p => p.prefixes.some(pre => n.startsWith(pre)))
  if (dv) return { cle: dv.cle, sens: dv.sens }
  if (n[0] !== '6' && n[0] !== '7') return null
  const p = POSTES.find(q => q.prefixes.some(pre => n.startsWith(pre)))
  return p ? { cle: p.cle, sens: p.sens } : null
}

function agreger(lignes: TrialBalanceLine[]) {
  const postes = POSTES.map(p => ({
    ...p,
    // Tous les postes du compte de résultat viennent de la balance Pennylane.
    titre: `Source : PENNYLANE — comptes ${p.prefixes.join(', ')}`,
    montant: 0,
    comptes: [] as { number: string; label: string; montant: number }[],
  }))

  for (const l of lignes) {
    const n = l.number
    if (n[0] !== '6' && n[0] !== '7') continue
    const poste = postes.find(p => p.prefixes.some(pre => n.startsWith(pre)))
    if (!poste) continue
    // Un produit est au crédit, une charge au débit : on prend le solde net
    // dans le sens naturel du compte pour qu'un avoir vienne en déduction.
    const montant = poste.sens === 'produit'
      ? num(l.credits) - num(l.debits)
      : num(l.debits) - num(l.credits)
    poste.montant += montant
    poste.comptes.push({ number: n, label: l.label, montant })
  }

  for (const p of postes) p.comptes.sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant))

  // Blocs hors résultat : volume encaissé et reversements, pour la lecture.
  const depotVente = POSTES_DEPOT_VENTE.map(p => {
    const comptes = lignes
      .filter(l => p.prefixes.some(pre => l.number.startsWith(pre)))
      .map(l => ({
        number: l.number,
        label: l.label,
        montant: p.sens === 'credit' ? num(l.credits) - num(l.debits) : num(l.debits) - num(l.credits),
      }))
      .sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant))
    return { cle: p.cle, label: p.label, titre: p.titre, montant: comptes.reduce((s, c) => s + c.montant, 0), comptes }
  })

  const produits = postes.filter(p => p.sens === 'produit').reduce((s, p) => s + p.montant, 0)
  const charges = postes.filter(p => p.sens === 'charge').reduce((s, p) => s + p.montant, 0)

  // Le compte de commissions est aussi débité (part commission des factures
  // chineuses, via la règle fournisseur). On montre le brut et la déduction
  // plutôt qu'un net qui cacherait l'écart.
  const commissionsBrutes = lignes
    .filter(l => l.number.startsWith('70'))
    .reduce((s, l) => s + num(l.credits), 0)
  const commissionsDeduites = lignes
    .filter(l => l.number.startsWith('70'))
    .reduce((s, l) => s + num(l.debits), 0)

  // Marge brute : ce qu'on garde sur ce que les clientes ont payé.
  const volumeChineuses = depotVente.find(p => p.cle === 'reversements')?.montant ?? 0
  const commission = postes.find(p => p.cle === 'ventes')?.montant ?? 0

  // Taux de commission réel : le seul 706101 rapporté au volume chineuses,
  // sans les ventes de stock propre ni le Printemps qui gonflent le 70.
  const commissions706 = lignes
    .filter(l => l.number.startsWith('706'))
    .reduce((s, l) => s + num(l.credits) - num(l.debits), 0)

  return {
    postes: postes.filter(p => p.comptes.length > 0),
    depotVente: depotVente.filter(p => p.comptes.length > 0),
    commissionsBrutes,
    commissionsDeduites,
    margeBrute: volumeChineuses > 0 ? (commission / volumeChineuses) * 100 : null,
    margeBruteBrute: volumeChineuses > 0 ? (commissionsBrutes / volumeChineuses) * 100 : null,
    tauxCommission: volumeChineuses > 0 ? (commissions706 / volumeChineuses) * 100 : null,
    produits,
    charges,
    resultat: produits - charges,
  }
}

// Découpe une période en mois civils (bornés par la période).
function moisDe(start: string, end: string) {
  const out: { cle: string; start: string; end: string }[] = []
  const d = new Date(start + 'T12:00:00')
  d.setDate(1)
  const fin = new Date(end + 'T12:00:00')
  while (d <= fin && out.length < 36) {
    const an = d.getFullYear()
    const mo = d.getMonth()
    const premier = `${an}-${String(mo + 1).padStart(2, '0')}-01`
    const dernier = new Date(an, mo + 1, 0)
    const dernierStr = `${an}-${String(mo + 1).padStart(2, '0')}-${String(dernier.getDate()).padStart(2, '0')}`
    out.push({
      cle: `${an}-${String(mo + 1).padStart(2, '0')}`,
      start: premier < start ? start : premier,
      end: dernierStr > end ? end : dernierStr,
    })
    d.setMonth(mo + 1)
  }
  return out
}

// Exécute `taches` par paquets pour ne pas marteler l'API Pennylane.
async function parPaquets<T>(taches: (() => Promise<T>)[], taille = 4): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < taches.length; i += taille) {
    out.push(...(await Promise.all(taches.slice(i, i + taille).map(t => t()))))
  }
  return out
}

// Pièces vendues et CA encaissé : ça n'existe pas dans la compta (Pennylane ne
// connaît que des commissions), ça vient de nos ventes. Requêtes d'agrégation
// Firestore : un count/sum ne lit pas les documents, ça reste quasi gratuit.
async function volumesParMois(mois: { cle: string; start: string; end: string }[]) {
  const res = await Promise.all(mois.map(async m => {
    const debut = Timestamp.fromDate(new Date(m.start + 'T00:00:00'))
    const fin = Timestamp.fromDate(new Date(m.end + 'T23:59:59.999'))
    const base = adminDb.collection('ventes')
      .where('dateVente', '>=', debut)
      .where('dateVente', '<=', fin)
    // Le count ne demande aucun index ; la somme de prixVenteReel en réclame un
    // composite (dateVente, prixVenteReel). Tant qu'il n'existe pas, on affiche
    // les pièces sans le CA plutôt que de faire tomber toute la page.
    const [pieces, ca] = await Promise.all([
      base.count().get().then(s => s.data().count || 0).catch(() => 0),
      base.aggregate({ ca: AggregateField.sum('prixVenteReel') }).get()
        .then(s => s.data().ca || 0).catch(() => null),
    ])
    return { cle: m.cle, pieces, ca }
  }))
  return Object.fromEntries(res.map(r => [r.cle, { pieces: r.pieces, ca: r.ca }]))
}

// Le Printemps verse deux fois par mois sur le compte Business : le vintage,
// qui tombe en début de mois suivant sans référence, et l'upcycling, qui se
// balade et porte un numéro de bordereau (PRI28, PRI30 PRI33…).
//
// Les mêmes montants réapparaissent ensuite sur le compte PRI : ce sont des
// virements internes, pas des recettes. On ne lit donc que le Business.
async function printempsParCanal(start: string, end: string) {
  const tx = await getTransactions()
  const vide = () => ({ vintage: 0, upcycling: 0 })
  const total = vide()
  const parMois: Record<string, { vintage: number; upcycling: number }> = {}
  const lignes: { cle: string; label: string; titre?: string; montant: number; mois?: string }[] = []
  let montantTotal = 0

  for (const t of tx) {
    if (!t.date || t.date < start || t.date > end) continue
    if (COMPTES_BANCAIRES_EXCLUS.includes(t.bank_account?.id)) continue
    const montant = Number(t.amount) || 0
    if (montant <= 0) continue
    const l = (t.label || '').toUpperCase()
    if (!/PRINTEMPS/.test(l) && !/\bPRI/.test(l)) continue

    // Upcycling dès qu'un numéro de bordereau est présent, vintage sinon.
    const canal: 'vintage' | 'upcycling' =
      /PRIU/.test(l) ? 'upcycling'
      : /PRIV/.test(l) ? 'vintage'
      : /\bPRI\s*\d/.test(l) ? 'upcycling'
      : 'vintage'

    const refs = [...new Set(l.match(/\bPRI[VU]?\d+/g) || [])]
    lignes.push({
      cle: `pri-${t.id}`,
      label: refs.length > 0 ? refs.join(' ') : (canal === 'vintage' ? 'Vintage' : 'Upcycling'),
      titre: `${t.date} — ${canal} — ${(t.label || '').replace(/\s+/g, ' ').trim()}`,
      montant,
      mois: t.date.slice(0, 7),
    })

    const cle = t.date.slice(0, 7)
    if (!parMois[cle]) parMois[cle] = vide()
    parMois[cle][canal] += montant
    total[canal] += montant
    montantTotal += montant
  }
  lignes.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  return { total, parMois, lignes, montantTotal }
}

// Marge sur notre propre stock, pièce par pièce : le prix de vente est sur la
// vente, le prix d'achat sur la fiche produit. Le compte 607 ne peut pas
// répondre, un lot acheté en janvier se revend sur plusieurs mois.
async function margeStockPropre(start: string, end: string) {
  const snap = await adminDb.collection('ventes')
    .where('trigramme', 'in', ['NR', 'ACH'])
    .where('dateVente', '>=', Timestamp.fromDate(new Date(start + 'T00:00:00')))
    .where('dateVente', '<=', Timestamp.fromDate(new Date(end + 'T23:59:59.999')))
    .get()

  const ids = [...new Set(snap.docs.map(d => d.data().produitId as string).filter(Boolean))]
  const achat = new Map<string, number>()
  for (let i = 0; i < ids.length; i += 300) {
    const refs = ids.slice(i, i + 300).map(id => adminDb.collection('produits').doc(id))
    for (const d of await adminDb.getAll(...refs)) {
      if (d.exists) achat.set(d.id, Number(d.data()?.prixAchat || 0))
    }
  }

  // On réutilise le calcul de marge de l'app (TVA sur marge, art. 297 A),
  // pas une formule refaite ici.
  const parMois: Record<string, { ventes: number; marge: number; cout: number }> = {}
  let ventes = 0
  let marge = 0
  let cout = 0
  for (const d of snap.docs) {
    const v = d.data()
    const cle = v.dateVente.toDate().toISOString().slice(0, 7)
    const pv = Number(v.prixVenteReel || 0)
    const m = calcMargeNette(pv, achat.get(v.produitId))
    if (m === null) continue
    const pa = achat.get(v.produitId) || 0
    if (!parMois[cle]) parMois[cle] = { ventes: 0, marge: 0, cout: 0 }
    parMois[cle].ventes += pv
    parMois[cle].marge += m
    parMois[cle].cout += pa
    ventes += pv
    marge += m
    cout += pa
  }
  return { parMois, ventes, marge, cout }
}

// Volume d'affaires par chineuse, lu sur nos ventes Square : le SKU porte le
// trigramme, donc la vente sait à qui elle appartient. On passe par des
// requêtes d'agrégation (count + sum), qui ne lisent pas les documents.
// La compta ne peut pas répondre à ça : les comptes 467 ne portent que ce qui
// a déjà été reversé, pas le volume vendu du mois.
async function volumesParChineuse(start: string, end: string) {
  const debut = Timestamp.fromDate(new Date(start + 'T00:00:00'))
  const fin = Timestamp.fromDate(new Date(end + 'T23:59:59.999'))

  const chineuses = (await adminDb.collection('chineuse').select('nom', 'trigramme', 'taux').get()).docs
    .map(d => ({
      nom: (d.data().nom as string) || d.id,
      trigramme: ((d.data().trigramme as string) || '').toUpperCase(),
      taux: Number(d.data().taux ?? 40),
    }))
    .filter(c => c.trigramme)

  const lignes = await parPaquets(
    chineuses.map(c => async () => {
      const base = adminDb.collection('ventes')
        .where('trigramme', '==', c.trigramme)
        .where('dateVente', '>=', debut)
        .where('dateVente', '<=', fin)
      const [pieces, volume] = await Promise.all([
        base.count().get().then(s => s.data().count || 0).catch(() => 0),
        base.aggregate({ ca: AggregateField.sum('prixVenteReel') }).get()
          .then(s => s.data().ca || 0).catch(() => null),
      ])
      // La commission revenant à NR1 : le taux de la chineuse appliqué au
      // volume TTC, comme sur sa facture mensuelle.
      const commission = volume != null ? (volume * c.taux) / 100 : null
      return { ...c, pieces, volume, commission }
    }),
    6,
  )

  return lignes
    .filter(l => l.pieces > 0 || (l.volume ?? 0) > 0)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
}

// Ce que Square a réellement viré sur le compte : les ventes moins ses frais,
// avec un décalage de règlement de un à deux jours.
async function recuEnBanque(start: string, end: string) {
  const tx = await getTransactions()
  const parMois: Record<string, number> = {}
  let total = 0
  for (const t of tx) {
    if (!t.date || t.date < start || t.date > end) continue
    const montant = Number(t.amount) || 0
    if (montant <= 0) continue
    if (!/SQUARE/i.test(t.label || '')) continue
    parMois[t.date.slice(0, 7)] = (parMois[t.date.slice(0, 7)] || 0) + montant
    total += montant
  }
  return { total, parMois }
}

// Ce que Square a encaissé pour une chineuse et qu'aucune facture ne couvre.
// Le SKU est dans le nom de l'article ; quand son préfixe ne correspond à
// aucun trigramme connu (ANAW, CJ, NP…), on va lire le trigramme du produit
// dans l'app, qui lui est toujours juste.
async function ecartParFacture(
  lignesSquare: { mois: string; nom: string; montant: number }[],
  facturé: SousLigne[],
): Promise<SousLigne[]> {
  const chineuses = (await adminDb.collection('chineuse').select('trigramme').get()).docs
    .map(d => ((d.data().trigramme as string) || '').toUpperCase().trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  const prefixe = (nom: string) => nom.match(/^([A-Za-z]+)\d/)?.[1]?.toUpperCase() || null
  const exact = new Set(chineuses)
  const inconnus = new Map<string, string>()   // SKU -> trigramme, lu dans l'app

  const aChercher = new Set<string>()
  for (const l of lignesSquare) {
    const p = prefixe(l.nom)
    if (!p || exact.has(p)) continue
    const sku = l.nom.match(/^([A-Za-z0-9]+)\s*-/)?.[1]
    if (sku) aChercher.add(sku)
  }
  // Une centaine de lectures au plus, et seulement quand on rafraîchit.
  for (const sku of [...aChercher].slice(0, 400)) {
    const snap = await adminDb.collection('produits').where('sku', '==', sku).limit(1).get().catch(() => null)
    if (snap && !snap.empty) {
      const t = ((snap.docs[0].data().trigramme as string) || '').toUpperCase().trim()
      if (t) inconnus.set(sku, t)
    }
  }

  const square: Record<string, number> = {}
  for (const l of lignesSquare) {
    const p = prefixe(l.nom)
    let t = p && exact.has(p) ? p : null
    if (!t) {
      const sku = l.nom.match(/^([A-Za-z0-9]+)\s*-/)?.[1]
      t = (sku && inconnus.get(sku)) || null
    }
    if (!t) continue
    square[`${t}|${l.mois}`] = (square[`${t}|${l.mois}`] || 0) + l.montant
  }

  // Ce qui est déjà facturé, lu sur la référence NRmmaa-TRI.
  const factures: Record<string, number> = {}
  for (const f of facturé) {
    const m = f.label.toUpperCase().match(/\bNR(\d{2})(\d{2})-?([A-Z0-9]{1,6})/)
    if (!m) continue
    factures[`${m[3]}|20${m[2]}-${m[1]}`] = (factures[`${m[3]}|20${m[2]}-${m[1]}`] || 0) + f.montant
  }

  const out: SousLigne[] = []
  for (const [cle, v] of Object.entries(square)) {
    const [t, mois] = cle.split('|')
    // NR et ACH sont notre propre stock : ils ont leur ligne, pas de facture.
    if (t === 'NR' || t === 'ACH') continue
    const manque = v - (factures[cle] || 0)
    if (manque < 10) continue
    out.push({
      cle: `ec-${cle}`,
      label: `NR${mois.slice(5)}${mois.slice(2, 4)}-${t}`,
      titre: `Source : SQUARE — ${v.toFixed(2)} € vendus, ${(factures[cle] || 0).toFixed(2)} € facturés`,
      montant: manque,
      mois,
    })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
}

// Détail à la ligne de chaque poste : une sous-ligne par écriture, nommée par
// sa facture (fournisseur + référence) ou, à défaut, par le libellé de
// l'écriture. On ne rapatrie que les comptes affichés et que les écritures
// qu'on va montrer : ~1 400 lignes sur un exercice, pas le grand livre entier.
type SousLigne = { cle: string; label: string; titre?: string; montant: number; mois?: string; horsNR?: boolean; info?: string }

// NR0526-PS → 2026-05, PRI1025TDO4 → 2025-10. Les bordereaux Printemps à deux
// chiffres (PRI30) ne sont pas des périodes : ils ne matchent pas.
function periodeDeLaReference(libelle: string): string | null {
  // Pas de \b après les chiffres : NR0825C141 colle son suffixe à la période.
  const m = libelle.toUpperCase().match(/\b(?:NR|PRI[VU]?)(\d{2})(\d{2})/)
  if (!m) return null
  const mois = Number(m[1])
  if (mois < 1 || mois > 12) return null
  return `20${m[2]}-${m[1]}`
}

// CHINEUZ2BLING numérote « 08-26 » : mois-année.
function periodeMoisAnnee(ref: string): string | null {
  const m = ref.match(/^(\d{1,2})-(\d{2})$/)
  if (!m) return null
  const mois = Number(m[1])
  if (mois < 1 || mois > 12) return null
  return `20${m[2]}-${String(mois).padStart(2, '0')}`
}

const MOIS_FR: Record<string, string> = {
  janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04', mai: '05',
  juin: '06', juillet: '07', août: '08', aout: '08', septembre: '09',
  octobre: '10', novembre: '11', décembre: '12', decembre: '12',
}

// « erreur avril - MLE INES PINEAU » : le mois est écrit en toutes lettres.
// L'année est celle de l'écriture, sauf si le mois lui est postérieur.
function periodeDuLibelle(libelle: string, date: string): string | null {
  const l = libelle.toLowerCase()
  for (const [nom, mm] of Object.entries(MOIS_FR)) {
    if (!new RegExp(`\\b${nom}\\b`).test(l)) continue
    const an = Number(date.slice(0, 4))
    return `${mm > date.slice(5, 7) ? an - 1 : an}-${mm}`
  }
  return null
}

async function detailParPoste(start: string, end: string) {
  const comptes = await getLedgerAccounts()
  const suivis = comptes.filter(c => posteDuCompte(c.number) !== null)
  if (suivis.length === 0) return { parPoste: {} as Record<string, SousLigne[]>, reversePrintemps: {} as Record<string, number>, volumes: [] as SousLigne[], commissions: [] as SousLigne[], nets: [] as SousLigne[], marchandises: [] as SousLigne[], achats: [] as SousLigne[], tva: [] as SousLigne[], services: [] as SousLigne[] }
  const nomDuCompte = new Map(suivis.map(c => [c.number, c.label]))

  const lignes = await getLignesDeComptes(suivis.map(c => c.id), start, end)
  const ecritures = [...new Set(lignes.map(l => l.ledger_entry?.id).filter(Boolean))] as number[]

  // Le libellé de l'écriture porte déjà « Facture BUNNY - INV123 » : inutile
  // d'aller chercher les factures et les fournisseurs, ce sont 7 appels de
  // moins et Pennylane limite le débit.
  const entetes = await getLedgerEntriesParIds(ecritures)
  const labelDeLEcriture = new Map(
    entetes.map(e => [e.id, (e.label || '').replace(/\(label généré\)/g, '').replace(/\s+/g, ' ').trim()]),
  )

  // On agrège par (poste, écriture) : une facture fournisseuse ventilée sur
  // deux comptes du même poste ne doit faire qu'une ligne.
  const cumul = new Map<string, SousLigne & { poste: string; horsNR?: boolean }>()
  // Ce que NR reverse aux chineuses du Printemps : leur volume moins la
  // commission et sa TVA. Rangé au mois de la période de la facture.
  const reversePrintemps: Record<string, number> = {}
  // Ce qu'on reverse vraiment aux chineuses de la boutique, écriture par
  // écriture : leur volume moins notre commission et sa TVA.
  const reverseNR = new Map<number, SousLigne>()
  // Les lignes « Commissions perçues » (706101) de ces mêmes factures.
  const commissionsNR = new Map<number, SousLigne>()
  const tvaNR = new Map<number, number>()
  // Un crédit 706 sans aucune ligne 467 n'est pas une commission sur ventes :
  // c'est ce que les chineuses du Printemps versent pour la gestion du corner.
  const aVolume = new Set<number>()
  // Nos propres ventes : les écritures « Ventes stock maison NR / NR ACHATS ».
  const marchandises = new Map<number, SousLigne>()
  // Ce qu'on achète pour revendre : Fleek, Vinted, Whatnot… (compte 607).
  const achats = new Map<number, SousLigne>()
  for (const l of lignes) {
    const numero = l.ledger_account?.number
    const idEcriture = l.ledger_entry?.id
    if (!numero || !idEcriture) continue
    const poste = posteDuCompte(numero)
    if (!poste) continue
    const montant = poste.sens === 'produit' || poste.sens === 'credit'
      ? num(l.credit) - num(l.debit)
      : num(l.debit) - num(l.credit)

    // « Facture MAKI CORP - OCULUS - NR0526-MAK » → « NR0526-MAK », le
    // fournisseur passe en info-bulle.
    const brut = labelDeLEcriture.get(idEcriture) || nomDuCompte.get(numero) || numero
    const bouts = brut.split(' - ')
    const estFacture = /^Facture\s/i.test(brut) && bouts.length > 1
    const dernier = bouts[bouts.length - 1]
    // On ne garde le dernier morceau que s'il ressemble à une référence.
    // « Facture CAMELEON - 7 » doit rester « CAMELEON - 7 », pas « 7 ».
    const refLisible = /[A-Za-z]/.test(dernier) && /\d/.test(dernier) && dernier.length >= 5
    const nom = estFacture
      ? (refLisible ? dernier : brut.replace(/^Facture\s+/i, ''))
      : brut
    // Une référence au format NRmmaa est boutique, point final : NR0226-PRI,
    // c'est PRISTINI, pas le stand du Printemps.
    const refNR = /^NR\d{4}/i.test(nom)
    // « 2025 / 13 » : la numérotation de TÊTE D'ORANGE pour son stand. Les huit
    // factures de cette série sont payées par un virement PRImmaaTDO.
    const serieAnnuelle = /^\d{4}\s*\/\s*\d+$/.test(dernier)
    // PRI suivi d'une période (PRI0725BLI1) ou d'un trigramme puis d'une
    // période (PRITDO0726). Surtout pas « PRISTINI », qui est une chineuse
    // de la boutique dont le trigramme commence par PRI.
    const horsNR = !refNR && (
      serieAnnuelle
      || /\bPRI\d{4}/i.test(brut)
      || /\bPRI[A-Z]{2,5}\d{2,4}/i.test(brut)
      || /avance/i.test(brut)
    )
    const periode = periodeDeLaReference(brut)
      || periodeMoisAnnee(dernier)
      || periodeDuLibelle(brut, l.date || '')
      || (l.date || '').slice(0, 7)

    const net = numero.startsWith('467')
      ? num(l.debit) - num(l.credit)
      : -(num(l.credit) - num(l.debit))
    // Uniquement les comptes d'une facture chineuse : le 707 porte les
    // encaissements du Printemps, pas un reversement.
    const compteFacture = numero.startsWith('467') || numero.startsWith('706') || numero === '44574'
    if (horsNR) {
      if (compteFacture) reversePrintemps[periode] = (reversePrintemps[periode] || 0) + net
    } else if (numero.startsWith('467')) {
      // Seuls les débits sont du volume : un crédit sur un compte 467, c'est
      // le virement qui part à la chineuse, pas une vente.
      const vol = num(l.debit)
      if (!vol) continue
      aVolume.add(idEcriture)
      const deja = reverseNR.get(idEcriture)
      if (deja) deja.montant += vol
      else reverseNR.set(idEcriture, {
        cle: `vol-${idEcriture}`, label: nom, titre: `${l.date} — ${brut}`, montant: vol, mois: periode,
      })
    } else if (numero.startsWith('706')) {
      const c = num(l.credit) - num(l.debit)
      const deja = commissionsNR.get(idEcriture)
      if (deja) deja.montant += c
      else commissionsNR.set(idEcriture, {
        cle: `com-${idEcriture}`, label: nom, titre: `${l.date} — ${brut}`, montant: c, mois: periode,
      })
    } else if (numero === '44574') {
      tvaNR.set(idEcriture, (tvaNR.get(idEcriture) || 0) + num(l.credit) - num(l.debit))
    }

    if (numero.startsWith('607')) {
      const v = num(l.debit) - num(l.credit)
      const deja = achats.get(idEcriture)
      if (deja) deja.montant += v
      else achats.set(idEcriture, {
        cle: `ach-${idEcriture}`, label: nom, titre: `${l.date} — ${brut}`, montant: v,
        mois: (l.date || '').slice(0, 7),
      })
    }

    if (numero.startsWith('707') && /stock maison/i.test(brut)) {
      const c = num(l.credit) - num(l.debit)
      const deja = marchandises.get(idEcriture)
      if (deja) deja.montant += c
      else marchandises.set(idEcriture, {
        cle: `mar-${idEcriture}`,
        label: brut.replace(/^Ventes stock maison\s*/i, ''),
        titre: `${l.date} — ${brut}`,
        montant: c,
        mois: (l.date || '').slice(0, 7),
      })
    }

    const cle = `${poste.cle}|${idEcriture}`
    const deja = cumul.get(cle)
    if (deja) { deja.montant += montant; continue }
    cumul.set(cle, {
      poste: poste.cle,
      cle: `d-${poste.cle}-${idEcriture}`,
      label: nom,
      titre: `${l.date} — ${brut} — ${numero} ${nomDuCompte.get(numero) || ''}`,
      montant,
      mois: periode,
      horsNR,
    })
  }

  const parPoste: Record<string, SousLigne[]> = {}
  for (const v of cumul.values()) {
    // Sous 1 €, ce sont des erratums et des frais bancaires : du bruit.
    if (Math.abs(v.montant) < 1) continue
    ;(parPoste[v.poste] ||= []).push({ cle: v.cle, label: v.label, titre: v.titre, montant: v.montant, mois: v.mois, horsNR: v.horsNR })
  }
  // Ordre alphabétique : on repère tout de suite la chineuse qui manque.
  for (const k of Object.keys(parPoste)) parPoste[k].sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  // Le taux de chaque facture, pour l'afficher à côté de sa commission.
  for (const [id, c] of commissionsNR) {
    const vol = reverseNR.get(id)?.montant ?? 0
    if (vol > 0) c.info = `${((c.montant / vol) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
  }

  // On sort du poste commissions tout ce qui n'a pas de volume en face.
  const services = new Map<number, SousLigne>()
  for (const [id, c] of commissionsNR) {
    if (aVolume.has(id)) continue
    services.set(id, { ...c, cle: `srv-${id}` })
    commissionsNR.delete(id)
    tvaNR.delete(id)
  }

  const trier = (m: Map<number, SousLigne>) => [...m.values()]
    .filter(r => Math.abs(r.montant) >= 1)
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))

  // La TVA facturée à la chineuse, sans les écritures « Récup. TVA sur
  // encaissements » : celles-ci portent le même compte mais au débit, et les
  // mélanger donnerait des mois négatifs alors qu'on facture tous les mois.
  const tvaFacturee = new Map<number, SousLigne>()
  for (const [id, v] of tvaNR) {
    const ref = reverseNR.get(id)
    if (!ref || v <= 0) continue
    tvaFacturee.set(id, { ...ref, cle: `tva-${id}`, montant: v })
  }

  // Ce que la chineuse touche vraiment : son volume moins notre commission
  // et la TVA dessus.
  const nets = new Map<number, SousLigne>()
  for (const [id, v] of reverseNR) {
    nets.set(id, { ...v, cle: `net-${id}`, montant: v.montant - (commissionsNR.get(id)?.montant ?? 0) - (tvaNR.get(id) ?? 0) })
  }
  return {
    parPoste, reversePrintemps,
    volumes: trier(reverseNR), commissions: trier(commissionsNR), nets: trier(nets),
    marchandises: trier(marchandises), achats: trier(achats), tva: trier(tvaFacturee),
    services: trier(services),
  }
}

export async function GET(req: NextRequest) {
  const refus = await requireAdmin(req)
  if (refus) return refus

  try {
    const sp = req.nextUrl.searchParams
    const exercices = await getFiscalYears()
    const aujourdhui = new Date().toISOString().slice(0, 10)
    const courant = exercices.find(e => e.start <= aujourdhui && aujourdhui <= e.finish) || exercices[0]

    const start = sp.get('start') || courant?.start || `${new Date().getFullYear()}-01-01`
    const end = sp.get('end') || (courant && courant.finish < aujourdhui ? courant.finish : aujourdhui)

    const cleCache = `${start}|${end}`
    const forcer = sp.get('refresh') === '1'
    const enCache = CACHE.get(cleCache)
    if (!forcer && enCache && Date.now() - enCache.le < TTL_PNL) {
      return NextResponse.json({ ...enCache.corps, calculeLe: new Date(enCache.le).toISOString(), ducache: true })
    }
    if (forcer) viderCacheTransactions()

    const mois = moisDe(start, end)
    const [comptes, balance, balancesMois, volumes, parChineuse, square, canaux, frais, stockPropre] = await Promise.all([
      getBankAccounts(),
      getTrialBalance(start, end),
      parPaquets(mois.map(m => () => getTrialBalance(m.start, m.end))),
      volumesParMois(mois),
      volumesParChineuse(start, end).catch(() => []),
      ventesSquare(start, end).catch(() => null),
      printempsParCanal(start, end).catch(() => null),
      fraisSquare(start, end).catch(() => null),
      margeStockPropre(start, end).catch(() => null),
    ])

    // Après les autres appels : lancé en même temps, Pennylane répond 429.
    const brutDetail = await detailParPoste(start, end)
      .catch(() => ({ parPoste: {} as Record<string, SousLigne[]>, reversePrintemps: {} as Record<string, number>, volumes: [] as SousLigne[], commissions: [] as SousLigne[], nets: [] as SousLigne[], marchandises: [] as SousLigne[], achats: [] as SousLigne[], tva: [] as SousLigne[], services: [] as SousLigne[] }))
    const detail = brutDetail.parPoste
    const reversePrintemps = brutDetail.reversePrintemps
    const volumesFactures = brutDetail.volumes
    const commissionsFactures = brutDetail.commissions
    const netsFactures = brutDetail.nets
    const marchandisesFactures = brutDetail.marchandises
    const achatsMarchandises = brutDetail.achats
    const tvaFactures = brutDetail.tva
    const servicesPrintemps = brutDetail.services

    // Les factures qui manquent face à Square, chineuse par chineuse.
    const recu = await recuEnBanque(start, end).catch(() => null)
    const ecarts = square
      ? await ecartParFacture(square.lignes, brutDetail.volumes).catch(() => [] as SousLigne[])
      : ([] as SousLigne[])

    // L'écart, c'est Square moins ce qui est facturé. Les factures manquantes
    // en expliquent une partie ; le reste s'affiche tel quel, sans l'habiller.
    if (square) {
      for (const m of mois) {
        const vendu = square.parMois[m.cle]?.net ?? 0
        const facture = brutDetail.volumes.filter(v => v.mois === m.cle).reduce((s2, v) => s2 + v.montant, 0)
        const propre = brutDetail.marchandises.filter(v => v.mois === m.cle).reduce((s2, v) => s2 + v.montant, 0)
        const explique = ecarts.filter(e => e.mois === m.cle).reduce((s2, e) => s2 + e.montant, 0)
        const reste = Math.round((vendu - facture - propre - explique) * 100) / 100
        if (Math.abs(reste) < 1) continue
        ecarts.push({
          cle: `nonexp-${m.cle}`,
          label: 'Non expliqué',
          titre: `Source : SQUARE ${vendu.toFixed(2)} € − factures ${facture.toFixed(2)} € − marchandises ${propre.toFixed(2)} €, dont ${explique.toFixed(2)} € identifiés`,
          montant: reste,
          mois: m.cle,
        })
      }
    }

    // Le compte PRI (stand Printemps) est marqué plutôt qu'exclu : la page
    // laisse choisir si on l'inclut ou non.
    const banques = comptes.map(c => ({
      id: c.id,
      nom: c.name,
      solde: num(c.balance),
      devise: c.currency,
      majLe: c.updated_at,
      pri: COMPTES_BANCAIRES_EXCLUS.includes(c.id),
    }))

    const corps = {
      success: true,
      periode: { start, end },
      exercices: exercices.map(e => ({ start: e.start, finish: e.finish, status: e.status })),
      tresorerie: {
        comptes: banques,
        total: banques.filter(c => !c.pri).reduce((s, c) => s + c.solde, 0),
        totalAvecPri: banques.reduce((s, c) => s + c.solde, 0),
      },
      pnl: (() => {
        const brut = agreger(balance)
        // Chaque poste se déplie à la ligne : facture, salaire, virement…
        const avecDetail = <T extends { cle: string }>(p: T) =>
          detail[p.cle]?.length ? { ...p, sousLignes: detail[p.cle] } : p
        const a = {
          ...brut,
          postes: brut.postes.map(avecDetail),
          depotVente: brut.depotVente.map(avecDetail),
        }
        if (!square) return a
        // Le volume d'affaires vient de Square, pas du compte de transit :
        // les virements décalent la fin de mois sur le mois suivant.
        // Les factures PRI et les avances sortent du volume boutique.
        // Le Printemps ne se lit plus sur le 707 (qui porte aussi le stock
        // propre) mais sur les encaissements reçus de Printemps SAS.
        const printemps = canaux && canaux.montantTotal > 0
          ? {
              cle: 'volumePrintemps',
              label: "Volume d'affaires Printemps",
              titre: 'Source : PENNYLANE — encaissements reçus de Printemps SAS',
              montant: canaux.montantTotal,
              comptes: [] as { number: string; label: string; montant: number }[],
              sousLignes: canaux.lignes,
            }
          : null
        // Le bloc se lit sur les factures chineuses : les lignes Reversement
        // CA donnent le volume, les 706101 la commission, et la différence
        // ce que la chineuse touche.
        const sommeL = (l: typeof volumesFactures) => l.reduce((s2, d) => s2 + d.montant, 0)
        const vide = [] as { number: string; label: string; montant: number }[]
        const reste = a.depotVente.flatMap(p =>
          p.cle === 'tvaCommission' && tvaFactures.length > 0
            ? [{
                ...p,
                montant: sommeL(tvaFactures),
                comptes: vide,
                sousLignes: tvaFactures,
              }] :
          p.cle === 'reversements' && commissionsFactures.length > 0
            ? [
                {
                  ...p,
                  label: 'Reversements chineuses',
                  titre: 'Calcul : Reversement CA − Commissions perçues − TVA',
                  montant: sommeL(netsFactures),
                  comptes: vide,
                  sousLignes: netsFactures,
                },
                {
                  cle: 'commissions',
                  label: 'Commissions perçues NR',
                  titre: 'Source : PENNYLANE — lignes 706101 des factures chineuses',
                  montant: sommeL(commissionsFactures),
                  comptes: vide,
                  sousLignes: commissionsFactures,
                },
              ]
            : [p],
        )
        return {
          ...a,
          // Sur les chineuses : notre commission rapportée à leur volume.
          margeChineuses: sommeL(volumesFactures) > 0
            ? (sommeL(commissionsFactures) / sommeL(volumesFactures)) * 100
            : null,
          // Sur notre propre stock : pièce par pièce, prix de vente contre
          // prix d'achat, pas le compte 607 du mois.
          margeAchat: stockPropre && stockPropre.ventes > 0
            ? (stockPropre.marge / stockPropre.ventes) * 100
            : null,
          postes: [
            ...a.postes,
            ...(frais && frais.total > 0 ? [{
              cle: 'fraisSquare',
              label: 'Frais Square',
              titre: 'Source : SQUARE — commissions de paiement, déduites avant virement',
              sens: 'charge' as const,
              prefixes: [] as string[],
              montant: frais.total,
              comptes: [] as { number: string; label: string; montant: number }[],
            }] : []),
          ],
          charges: a.charges + (frais?.total ?? 0),
          resultat: a.resultat - (frais?.total ?? 0),
          depotVente: ([

            {
              cle: 'volume',
              label: "Volume d'affaires NR",
              titre: 'Source : SQUARE',
              montant: square.total,
              comptes: [],
              gras: true,
            },
            {
              cle: 'volumeFacture',
              label: 'dont facturé aux chineuses',
              titre: 'Source : PENNYLANE — lignes Reversement CA des factures chineuses',
              montant: sommeL(volumesFactures),
              comptes: [],
              sousLignes: volumesFactures,
              indent: true,
            },
            {
              cle: 'volumeMarchandises',
              label: 'dont ventes de marchandises (NR + NR achats)',
              titre: 'Source : PENNYLANE — écritures Ventes stock maison, compte 707',
              montant: sommeL(marchandisesFactures),
              comptes: [],
              sousLignes: marchandisesFactures,
              indent: true,
            },
            ...(printemps ? [printemps] : []),
            ...(canaux
              ? [
                  { cle: 'priVintage', label: 'dont vintage', titre: 'Source : PENNYLANE — virements PRIV', montant: canaux.total.vintage, comptes: [], indent: true },
                  { cle: 'priUpcycling', label: 'dont upcycling', titre: 'Source : PENNYLANE — virements PRIU et bordereaux numérotés', montant: canaux.total.upcycling, comptes: [], indent: true },
                ]
              : []),
            {
              cle: 'volumeTotal',
              label: "Volume d'affaires total",
              titre: "Calcul : volume d'affaires NR + Printemps",
              montant: square.total + (printemps?.montant ?? 0),
              comptes: [],
              gras: true,
            },
            {
              cle: 'ecart',
              label: 'Écart non facturé',
              titre: 'Calcul : SQUARE − factures chineuses − ventes de marchandises',
              // Le total, c'est la somme des lignes : une facture de rattrapage
              // qui couvre plusieurs mois ne doit pas créer un écart négatif.
              montant: square.total - sommeL(volumesFactures) - sommeL(marchandisesFactures),
              comptes: [],
              sousLignes: ecarts,
              indent: true,
              alerte: true,
            },
            ...(frais && square.total > 0 ? [{
              cle: 'fraisSquareVolume',
              label: 'Écart frais bancaires',
              titre: 'Source : SQUARE — commissions de paiement prélevées avant virement',
              montant: -frais.total,
              comptes: [] as { number: string; label: string; montant: number }[],
              indent: true,
              alerte: true,
              info: `${((frais.total / square.total) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`,
            }] : []),
            ...(recu ? [{
              cle: 'recuBanque',
              label: "Volume d'affaires reçu en banque",
              titre: 'Source : SHINE — virements reçus de Square',
              montant: recu.total,
              comptes: [] as { number: string; label: string; montant: number }[],
            }] : []),
            ...reste,
            {
              cle: 'caMarchandises',
              label: 'Ventes de marchandises NR',
              titre: 'Source : PENNYLANE — écritures Ventes stock maison, compte 707',
              montant: sommeL(marchandisesFactures),
              comptes: [] as { number: string; label: string; montant: number }[],
              sousLignes: marchandisesFactures,
            },
            ...(printemps ? [{
              cle: 'caPrintemps',
              label: "Chiffre d'affaires Printemps",
              titre: 'Calcul : encaissements Printemps − reversements à ses chineuses',
              montant: printemps.montant - Object.values(reversePrintemps).reduce((s2, v) => s2 + v, 0),
              comptes: [] as { number: string; label: string; montant: number }[],
            }] : []),
            ...(servicesPrintemps.length > 0 ? [{
              cle: 'servicesPrintemps',
              label: 'Rémunération de gestion du corner',
              titre: 'Source : PENNYLANE — versements des chineuses du Printemps, 706 sans volume',
              montant: sommeL(servicesPrintemps),
              comptes: [] as { number: string; label: string; montant: number }[],
              sousLignes: servicesPrintemps,
            }] : []),
            {
              cle: 'caTotal',
              label: "Chiffre d'affaires NR",
              titre: 'Calcul : commissions perçues + ventes de marchandises',
              montant: sommeL(commissionsFactures) + sommeL(marchandisesFactures),
              comptes: [] as { number: string; label: string; montant: number }[],
              gras: true,
            },
            ...(printemps ? [{
              cle: 'caGlobal',
              label: "Chiffre d'affaires total",
              titre: "Calcul : chiffre d'affaires NR + Printemps + gestion du corner",
              montant: sommeL(commissionsFactures) + sommeL(marchandisesFactures) + sommeL(servicesPrintemps)
                + printemps.montant - Object.values(reversePrintemps).reduce((s2, v) => s2 + v, 0),
              comptes: [] as { number: string; label: string; montant: number }[],
              gras: true,
            }] : []),
            ...(stockPropre && stockPropre.cout > 0 ? [{
              cle: 'coutVendu',
              label: 'Coût des marchandises vendues ce mois',
              titre: "Source : APP NR — prix d'achat des pièces vendues dans le mois",
              montant: stockPropre.cout,
              comptes: [] as { number: string; label: string; montant: number }[],
            }] : []),
            ...(stockPropre && stockPropre.ventes > 0 ? [
              {
                cle: 'margeMarchandises',
                label: 'Marge brute TTC',
                titre: 'Calcul : ventes − achats, hors transport',
                montant: stockPropre.ventes - stockPropre.cout,
                comptes: [] as { number: string; label: string; montant: number }[],
              },
              {
                cle: 'tvaSurMarge',
                label: 'TVA sur marge',
                titre: 'Calcul : marge brute TTC × 20/120 (régime de la TVA sur marge)',
                montant: -((stockPropre.ventes - stockPropre.cout) - stockPropre.marge),
                comptes: [] as { number: string; label: string; montant: number }[],
              },
              {
                cle: 'margeMarchandisesHt',
                label: 'Marge brute HT',
                titre: 'Calcul : marge brute TTC − TVA sur marge',
                montant: stockPropre.marge,
                comptes: [] as { number: string; label: string; montant: number }[],
                gras: true,
              },
            ] : []),
            {
              cle: 'achatsMarchandises',
              label: 'Achats de marchandises ce mois',
              titre: 'Source : PENNYLANE — compte 607',
              montant: sommeL(achatsMarchandises),
              comptes: [],
              sousLignes: achatsMarchandises,
            },
          ] as any[]).map(p => ({
            ...p,
            // Deux blocs de lecture : ce qui a été vendu, puis ce qu'on en garde.
            bloc: ['volume', 'volumeFacture', 'ecart', 'volumeMarchandises',
                   'volumePrintemps', 'priVintage', 'priUpcycling',
                   'volumeTotal', 'recuBanque', 'fraisSquareVolume'].includes(p.cle)
              ? "Volume d'affaires"
              : ['commissions', 'tvaCommission', 'caMarchandises', 'caTotal', 'caPrintemps', 'servicesPrintemps', 'caGlobal'].includes(p.cle)
                ? "Chiffre d'affaires"
                : 'Charges variables',
          }))
            // Les blocs se suivent, et les lignes gardent un ordre de lecture fixe.
            .sort((a, b) => {
              const bloc = ORDRE_BLOCS.indexOf(a.bloc) - ORDRE_BLOCS.indexOf(b.bloc)
              if (bloc !== 0) return bloc
              const i = ORDRE_LIGNES.indexOf(a.cle), j = ORDRE_LIGNES.indexOf(b.cle)
              return (i === -1 ? 99 : i) - (j === -1 ? 99 : j)
            }),
        }
      })(),
      parChineuse,
      // Printemps : ce qu'il nous verse moins ce qu'on reverse à ses chineuses.
      // Le reste du résultat est celui de la boutique.
      resultatPrintemps: (canaux?.montantTotal ?? 0)
        - Object.values(reversePrintemps).reduce((s2, v) => s2 + v, 0),
      mois: mois.map((m, i) => {
        const a = agreger(balancesMois[i])
        return {
          cle: m.cle,
          produits: a.produits,
          charges: a.charges + (frais?.parMois[m.cle] ?? 0),
          resultat: a.resultat - (frais?.parMois[m.cle] ?? 0),
          postes: {
            ...Object.fromEntries([...a.postes, ...a.depotVente].map(p => [p.cle, p.montant])),
            ...(square
              ? (() => {
                  const somme = (l: typeof volumesFactures) =>
                    l.filter(r => r.mois === m.cle).reduce((s2, r) => s2 + r.montant, 0)
                  const nr = somme(volumesFactures)
                  const v = canaux?.parMois[m.cle]?.vintage ?? 0
                  const u = canaux?.parMois[m.cle]?.upcycling ?? 0
                  return {
                    volume: square.parMois[m.cle]?.net ?? 0,
                    volumeFacture: nr,
                    volumeMarchandises: somme(marchandisesFactures),
                    ecart: (square.parMois[m.cle]?.net ?? 0) - nr - somme(marchandisesFactures),
                    fraisSquare: frais?.parMois[m.cle] ?? 0,
                    fraisSquareVolume: -(frais?.parMois[m.cle] ?? 0),
                    recuBanque: recu?.parMois[m.cle] ?? 0,
                    volumePrintemps: v + u,
                    volumeTotal: (square.parMois[m.cle]?.net ?? 0) + v + u,
                    priVintage: v,
                    priUpcycling: u,
                    reversements: somme(netsFactures),
                    commissions: somme(commissionsFactures),
                    tvaCommission: somme(tvaFactures),
                    caMarchandises: somme(marchandisesFactures),
                    caTotal: somme(commissionsFactures) + somme(marchandisesFactures),
                    caPrintemps: ((canaux?.parMois[m.cle]?.vintage ?? 0) + (canaux?.parMois[m.cle]?.upcycling ?? 0))
                      - (reversePrintemps[m.cle] ?? 0),
                    servicesPrintemps: somme(servicesPrintemps),
                    caGlobal: somme(commissionsFactures) + somme(marchandisesFactures) + somme(servicesPrintemps)
                      + ((canaux?.parMois[m.cle]?.vintage ?? 0) + (canaux?.parMois[m.cle]?.upcycling ?? 0))
                      - (reversePrintemps[m.cle] ?? 0),
                    achatsMarchandises: somme(achatsMarchandises),
                    coutVendu: stockPropre?.parMois[m.cle]?.cout ?? 0,
                    margeMarchandises: (stockPropre?.parMois[m.cle]?.ventes ?? 0) - (stockPropre?.parMois[m.cle]?.cout ?? 0),
                    margeMarchandisesHt: stockPropre?.parMois[m.cle]?.marge ?? 0,
                    tvaSurMarge: -(((stockPropre?.parMois[m.cle]?.ventes ?? 0) - (stockPropre?.parMois[m.cle]?.cout ?? 0))
                      - (stockPropre?.parMois[m.cle]?.marge ?? 0)),
                  }
                })()
              : {}),
          },
          margeChineuses: (() => {
            const v = volumesFactures.filter(r => r.mois === m.cle).reduce((s2, r) => s2 + r.montant, 0)
            const c = commissionsFactures.filter(r => r.mois === m.cle).reduce((s2, r) => s2 + r.montant, 0)
            return v > 0 ? (c / v) * 100 : null
          })(),
          margeAchat: (() => {
            const x = stockPropre?.parMois[m.cle]
            return x && x.ventes > 0 ? (x.marge / x.ventes) * 100 : null
          })(),
          resultatPrintemps:
            ((canaux?.parMois[m.cle]?.vintage ?? 0) + (canaux?.parMois[m.cle]?.upcycling ?? 0))
            - (reversePrintemps[m.cle] ?? 0),
          pieces: volumes[m.cle]?.pieces ?? 0,
          caVentes: volumes[m.cle]?.ca ?? null,
          volumeSquare: square?.parMois[m.cle]?.net ?? null,
        }
      }),
    }

    CACHE.set(cleCache, { le: Date.now(), corps })
    return NextResponse.json({ ...corps, calculeLe: new Date().toISOString(), ducache: false })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erreur Pennylane' }, { status: 500 })
  }
}
