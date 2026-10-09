// app/api/admin/pnl/route.ts
// P&L réel = la compta, pas nos estimations : on lit la balance générale
// Pennylane (comptes 6 = charges, 7 = produits) et les soldes bancaires des
// comptes agrégés. Admin uniquement, token Pennylane côté serveur seulement.
//
// GET ?start=YYYY-MM-DD&end=YYYY-MM-DD (défaut : exercice en cours)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
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

    const [comptes, balance] = await Promise.all([getBankAccounts(), getTrialBalance(start, end)])

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
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erreur Pennylane' }, { status: 500 })
  }
}
