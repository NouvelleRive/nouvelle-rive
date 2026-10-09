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

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

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

  const produits = postes.filter(p => p.sens === 'produit').reduce((s, p) => s + p.montant, 0)
  const charges = postes.filter(p => p.sens === 'charge').reduce((s, p) => s + p.montant, 0)

  return {
    postes: postes.filter(p => p.comptes.length > 0),
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
    const [comptes, balance, balancesMois, volumes] = await Promise.all([
      getBankAccounts(),
      getTrialBalance(start, end),
      parPaquets(mois.map(m => () => getTrialBalance(m.start, m.end))),
      volumesParMois(mois),
    ])

    const banques = comptes.map(c => ({
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
      pnl: agreger(balance),
      mois: mois.map((m, i) => {
        const a = agreger(balancesMois[i])
        return {
          cle: m.cle,
          produits: a.produits,
          charges: a.charges,
          resultat: a.resultat,
          postes: Object.fromEntries(a.postes.map(p => [p.cle, p.montant])),
          pieces: volumes[m.cle]?.pieces ?? 0,
          caVentes: volumes[m.cle]?.ca ?? null,
        }
      }),
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erreur Pennylane' }, { status: 500 })
  }
}
