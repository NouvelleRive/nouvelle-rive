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
import { ventesSquare } from '@/lib/squareVentes'

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
const POSTES: { cle: string; label: string; sens: 'produit' | 'charge'; prefixes: string[] }[] = [
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
    titre: 'Source : Pennylane, comptes 467xxx',
    prefixes: ['467'],
    sens: 'debit' as const,
  },
  {
    cle: 'tvaCommission',
    label: 'dont TVA sur commission',
    titre: 'Source : Pennylane, compte 44574',
    prefixes: ['44574'],
    sens: 'credit' as const,
  },
]

// Le P&L ne bouge pas d'une minute à l'autre : on garde la réponse en mémoire
// du serveur et on ne retape Pennylane que sur demande (bouton « mettre à
// jour », ?refresh=1). Cache par instance, perdu au redéploiement, gratuit.
const CACHE = new Map<string, { le: number; corps: any }>()
const TTL_PNL = 30 * 24 * 60 * 60 * 1000

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
  const postes = POSTES.map(p => ({ ...p, montant: 0, comptes: [] as { number: string; label: string; montant: number }[] }))

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
  lignes.sort((a, b) => b.montant - a.montant)
  return { total, parMois, lignes, montantTotal }
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

// Détail à la ligne de chaque poste : une sous-ligne par écriture, nommée par
// sa facture (fournisseur + référence) ou, à défaut, par le libellé de
// l'écriture. On ne rapatrie que les comptes affichés et que les écritures
// qu'on va montrer : ~1 400 lignes sur un exercice, pas le grand livre entier.
type SousLigne = { cle: string; label: string; titre?: string; montant: number; mois?: string }

// NR0526-PS → 2026-05, PRI1025TDO4 → 2025-10. Les bordereaux Printemps à deux
// chiffres (PRI30) ne sont pas des périodes : ils ne matchent pas.
function periodeDeLaReference(libelle: string): string | null {
  const m = libelle.toUpperCase().match(/\b(?:NR|PRI[VU]?)(\d{2})(\d{2})\b/)
  if (!m) return null
  const mois = Number(m[1])
  if (mois < 1 || mois > 12) return null
  return `20${m[2]}-${m[1]}`
}

async function detailParPoste(start: string, end: string): Promise<Record<string, SousLigne[]>> {
  const comptes = await getLedgerAccounts()
  const suivis = comptes.filter(c => posteDuCompte(c.number) !== null)
  if (suivis.length === 0) return {}
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
  const cumul = new Map<string, SousLigne & { poste: string }>()
  for (const l of lignes) {
    const numero = l.ledger_account?.number
    const idEcriture = l.ledger_entry?.id
    if (!numero || !idEcriture) continue
    const poste = posteDuCompte(numero)
    if (!poste) continue
    const montant = poste.sens === 'produit' || poste.sens === 'credit'
      ? num(l.credit) - num(l.debit)
      : num(l.debit) - num(l.credit)

    const cle = `${poste.cle}|${idEcriture}`
    const deja = cumul.get(cle)
    if (deja) { deja.montant += montant; continue }
    // « Facture MAKI CORP - OCULUS - NR0526-MAK » → « NR0526-MAK », le
    // fournisseur passe en info-bulle.
    const brut = labelDeLEcriture.get(idEcriture) || nomDuCompte.get(numero) || numero
    const bouts = brut.split(' - ')
    const estFacture = /^Facture\s/i.test(brut) && bouts.length > 1
    const nom = estFacture ? bouts[bouts.length - 1] : brut
    cumul.set(cle, {
      poste: poste.cle,
      cle: `d-${poste.cle}-${idEcriture}`,
      label: nom,
      titre: `${l.date} — ${brut} — ${numero} ${nomDuCompte.get(numero) || ''}`,
      montant,
      // La période, c'est celle de la référence : NR0526 = mai 2026, même si
      // la facture est datée du 1er juin et payée le 10.
      mois: periodeDeLaReference(brut) || (l.date || '').slice(0, 7),
    })
  }

  const parPoste: Record<string, SousLigne[]> = {}
  for (const v of cumul.values()) {
    if (Math.abs(v.montant) < 0.005) continue
    ;(parPoste[v.poste] ||= []).push({ cle: v.cle, label: v.label, titre: v.titre, montant: v.montant, mois: v.mois })
  }
  for (const k of Object.keys(parPoste)) parPoste[k].sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant))
  return parPoste
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
    const [comptes, balance, balancesMois, volumes, parChineuse, square, canaux] = await Promise.all([
      getBankAccounts(),
      getTrialBalance(start, end),
      parPaquets(mois.map(m => () => getTrialBalance(m.start, m.end))),
      volumesParMois(mois),
      volumesParChineuse(start, end).catch(() => []),
      ventesSquare(start, end).catch(() => null),
      printempsParCanal(start, end).catch(() => null),
    ])

    // Après les autres appels : lancé en même temps, Pennylane répond 429.
    const detail = await detailParPoste(start, end).catch(() => ({} as Record<string, SousLigne[]>))

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
        // Le Printemps ne se lit plus sur le 707 (qui porte aussi le stock
        // propre) mais sur les encaissements reçus de Printemps SAS.
        const printemps = canaux && canaux.montantTotal > 0
          ? {
              cle: 'volumePrintemps',
              label: "Volume d'affaires Printemps",
              titre: 'Encaissements reçus de Printemps SAS',
              montant: canaux.montantTotal,
              comptes: [] as { number: string; label: string; montant: number }[],
            }
          : null
        const reste = a.depotVente
        return {
          ...a,
          depotVente: [
            {
              cle: 'volume',
              label: "Volume d'affaires NR",
              titre: 'Source : Square',
              montant: square.total,
              comptes: [],
              // Le détail, c'est la facture de chaque chineuse (NR0126-PS) :
              // même liste que les reversements, et elle est datée.
              sousLignes: detail['reversements'] ?? [],
            },
            ...(printemps
              ? [{
                  ...printemps,
                  // Le détail vintage / upcycling se déplie sous VA Printemps.
                  sousLignes: canaux
                    ? [
                        { cle: 'priVintage', label: 'dont vintage', titre: 'Virements PRIV', montant: canaux.total.vintage },
                        { cle: 'priUpcycling', label: 'dont upcycling', titre: 'Virements PRIU', montant: canaux.total.upcycling },
                        ...canaux.lignes,
                      ]
                    : [],
                }]
              : []),
            {
              cle: 'volumeTotal',
              label: "Volume d'affaires total",
              titre: "Volume d'affaires NR + Printemps",
              montant: square.total + (printemps?.montant ?? 0),
              comptes: [],
              sousLignes: [
                { cle: 'volume', label: "Volume d'affaires NR", montant: square.total },
                ...(printemps ? [{ cle: 'volumePrintemps', label: "Volume d'affaires Printemps", montant: printemps.montant }] : []),
              ],
            },
            ...reste,
          ],
        }
      })(),
      parChineuse,
      mois: mois.map((m, i) => {
        const a = agreger(balancesMois[i])
        return {
          cle: m.cle,
          produits: a.produits,
          charges: a.charges,
          resultat: a.resultat,
          postes: {
            ...Object.fromEntries([...a.postes, ...a.depotVente].map(p => [p.cle, p.montant])),
            ...(square
              ? (() => {
                  const nr = square.parMois[m.cle]?.net ?? 0
                  const v = canaux?.parMois[m.cle]?.vintage ?? 0
                  const u = canaux?.parMois[m.cle]?.upcycling ?? 0
                  return {
                    volume: nr,
                    volumePrintemps: v + u,
                    volumeTotal: nr + v + u,
                    priVintage: v,
                    priUpcycling: u,
                  }
                })()
              : {}),
          },
          margeBrute: a.margeBrute,
          tauxCommission: a.tauxCommission,
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
