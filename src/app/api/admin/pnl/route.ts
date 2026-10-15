// app/api/admin/pnl/route.ts
// P&L réel = la compta, pas nos estimations : on lit la balance générale
// Pennylane (comptes 6 = charges, 7 = produits) et les soldes bancaires des
// comptes agrégés. Admin uniquement, token Pennylane côté serveur seulement.
//
// GET ?start=YYYY-MM-DD&end=YYYY-MM-DD (défaut : exercice en cours)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { AggregateField, Timestamp } from 'firebase-admin/firestore'
import { getBankAccounts, getFiscalYears, getTrialBalance, type TrialBalanceLine } from '@/lib/pennylane'
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
    cle: 'volumePrintemps',
    label: 'VA Printemps',
    titre: "Source : balance Pennylane, compte 707 Ventes de marchandises — ce que le Printemps nous verse, volet vintage et concession GIGI PARIS confondus. Ce n'est pas le ticket de caisse du stand : sur la concession, le Printemps déduit 26 % avant de verser. Déjà compté dans Ventes & commissions.",
    prefixes: ['707'],
    sens: 'credit' as const,
  },
  {
    cle: 'reversements',
    label: 'Reversements chineuses TTC',
    titre: "Source : balance Pennylane, comptes 467xxx Reversement CA — le volume déjà reversé à chaque chineuse, TTC. Il se partage en sa part (401), la TVA (44574) et notre commission (706101). Ni produit ni charge.",
    prefixes: ['467'],
    sens: 'debit' as const,
  },
  {
    cle: 'tvaCommission',
    label: 'TVA sur commission',
    titre: 'Source : balance Pennylane, compte 44574 TVA collectée sur encaissements — la TVA que nous reversons sur notre commission',
    prefixes: ['44574'],
    sens: 'credit' as const,
  },
]

const num = (v: string) => Number(v) || 0

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

  return {
    postes: postes.filter(p => p.comptes.length > 0),
    depotVente: depotVente.filter(p => p.comptes.length > 0),
    commissionsBrutes,
    commissionsDeduites,
    margeBrute: volumeChineuses > 0 ? (commission / volumeChineuses) * 100 : null,
    margeBruteBrute: volumeChineuses > 0 ? (commissionsBrutes / volumeChineuses) * 100 : null,
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

    const mois = moisDe(start, end)
    const [comptes, balance, balancesMois, volumes, parChineuse, square] = await Promise.all([
      getBankAccounts(),
      getTrialBalance(start, end),
      parPaquets(mois.map(m => () => getTrialBalance(m.start, m.end))),
      volumesParMois(mois),
      volumesParChineuse(start, end).catch(() => []),
      ventesSquare(start, end).catch(() => null),
    ])

    const banques = comptes
      .filter(c => !COMPTES_BANCAIRES_EXCLUS.includes(c.id))
      .map(c => ({
        id: c.id,
        nom: c.name,
        solde: num(c.balance),
        devise: c.currency,
        majLe: c.updated_at,
      }))

    return NextResponse.json({
      success: true,
      periode: { start, end },
      exercices: exercices.map(e => ({ start: e.start, finish: e.finish, status: e.status })),
      tresorerie: { comptes: banques, total: banques.reduce((s, c) => s + c.solde, 0) },
      pnl: (() => {
        const a = agreger(balance)
        if (!square) return a
        // Le volume d'affaires vient de Square, pas du compte de transit :
        // les virements décalent la fin de mois sur le mois suivant.
        return {
          ...a,
          depotVente: [
            {
              cle: 'volume',
              label: 'VA NR',
              titre: `Source : API Square, ventes nettes encaissées en boutique sur la période (${square.commandes} commandes, remboursements déduits). Pas le compte 511301, qui porte les virements Square et décale la fin de mois.`,
              montant: square.total,
              comptes: [],
            },
            ...a.depotVente,
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
            ...(square ? { volume: square.parMois[m.cle]?.net ?? 0 } : {}),
          },
          margeBrute: a.margeBrute,
          pieces: volumes[m.cle]?.pieces ?? 0,
          caVentes: volumes[m.cle]?.ca ?? null,
          volumeSquare: square?.parMois[m.cle]?.net ?? null,
        }
      }),
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erreur Pennylane' }, { status: 500 })
  }
}
