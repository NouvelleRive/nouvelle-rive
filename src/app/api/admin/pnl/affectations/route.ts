// app/api/admin/pnl/affectations/route.ts
// Réaffectation des factures tombées sur le mauvais compte.
//
// Une facture de chineuse doit débiter son compte de tiers (467xxx) ; quand
// l'affectation n'a pas été faite, elle débite le compte de commissions
// (706101) et ampute le chiffre. Les règles de portée « écriture » disent
// quel libellé va vers quel compte ; ici on les applique.
//
// GET  : ce qui serait réaffecté, groupé par compte de destination.
// POST : applique (simulation par défaut).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { getLedgerAccounts, getLedgerEntries, getLedgerEntryLines, reaffecterLigne } from '@/lib/pennylane'
import { trouverRegleEcriture, type Regle } from '@/lib/pnlRegles'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'
const DOC = () => adminDb.collection('siteConfig').doc('_pnlRegles')

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

type Cible = {
  entryId: number
  lineId: number
  date: string
  montant: number
  libelle: string
  source: string
  compte: string
  compteLabel: string
  compteId: number
}

async function calculer(debut: string, fin: string) {
  const snap = await DOC().get()
  const regles: Regle[] = (snap.exists ? (snap.data()?.regles as Regle[]) : []) || []
  const reglesEcriture = regles.filter(r => r.portee === 'ecriture' && r.actif)
  if (!reglesEcriture.length) return { regles: 0, cibles: [] as Cible[], comptesManquants: [] as string[] }

  const [comptes, entrees, lignes] = await Promise.all([
    getLedgerAccounts(), getLedgerEntries(debut, fin), getLedgerEntryLines(debut, fin),
  ])
  const parNumero = new Map(comptes.map(c => [c.number, c]))
  const libelleDe = new Map(entrees.map(e => [e.id, (e.label || '').split('\n')[0]]))
  const sources = new Set(reglesEcriture.map(r => r.compteSource).filter(Boolean) as string[])

  const cibles: Cible[] = []
  const manquants = new Set<string>()
  for (const l of lignes) {
    const num = l.ledger_account?.number
    if (!num || !sources.has(num)) continue
    const debit = Number(l.debit) || 0
    if (debit <= 0) continue
    const libelle = libelleDe.get(l.ledger_entry.id) || ''
    const regle = trouverRegleEcriture(reglesEcriture, libelle, num)
    if (!regle?.compte) continue
    const cible = parNumero.get(regle.compte)
    if (!cible) { manquants.add(regle.compte); continue }
    cibles.push({
      entryId: l.ledger_entry.id,
      lineId: l.id,
      date: l.date,
      montant: debit,
      libelle,
      source: num,
      compte: regle.compte,
      compteLabel: cible.label,
      compteId: cible.id,
    })
  }
  return { regles: reglesEcriture.length, cibles, comptesManquants: [...manquants] }
}

const bornes = (req: NextRequest, body?: any) => {
  const sp = req.nextUrl.searchParams
  const an = new Date().getFullYear()
  return {
    debut: body?.debut || sp.get('debut') || `${an}-01-01`,
    fin: body?.fin || sp.get('fin') || `${an}-12-31`,
  }
}

export async function GET(req: NextRequest) {
  const refus = await requireAdmin(req)
  if (refus) return refus
  try {
    const { debut, fin } = bornes(req)
    const { regles, cibles, comptesManquants } = await calculer(debut, fin)

    const groupes = new Map<string, { compte: string; compteLabel: string; nb: number; total: number; lignes: Cible[] }>()
    for (const c of cibles) {
      const g = groupes.get(c.compte) || { compte: c.compte, compteLabel: c.compteLabel, nb: 0, total: 0, lignes: [] }
      g.nb += 1; g.total += c.montant; g.lignes.push(c)
      groupes.set(c.compte, g)
    }

    return NextResponse.json({
      success: true,
      periode: { debut, fin },
      regles,
      comptesManquants,
      total: cibles.reduce((s, c) => s + c.montant, 0),
      nb: cibles.length,
      groupes: [...groupes.values()]
        .map(g => ({ ...g, lignes: g.lignes.sort((a, b) => b.montant - a.montant) }))
        .sort((a, b) => b.total - a.total),
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erreur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const refus = await requireAdmin(req)
  if (refus) return refus
  try {
    const body = await req.json()
    const { debut, fin } = bornes(req, body)
    const simulation = body.simulation !== false
    const limite = Number(body.limite) || 0

    const { cibles } = await calculer(debut, fin)
    // Les plus petits montants d'abord : un test porte sur une ligne anodine.
    const ordonnees = [...cibles].sort((a, b) => a.montant - b.montant)
    const aTraiter = limite > 0 ? ordonnees.slice(0, limite) : ordonnees

    if (simulation) {
      return NextResponse.json({
        success: true, simulation: true, nb: aTraiter.length,
        total: aTraiter.reduce((s, c) => s + c.montant, 0),
        apercu: aTraiter.slice(0, 20),
      })
    }

    let ok = 0
    const erreurs: { entryId: number; erreur: string }[] = []
    for (const c of aTraiter) {
      try {
        await reaffecterLigne(c.entryId, c.lineId, c.compteId)
        ok += 1
      } catch (e: any) {
        erreurs.push({ entryId: c.entryId, erreur: String(e?.message || e).slice(0, 200) })
        if (erreurs.length >= 5) break
      }
    }
    return NextResponse.json({ success: true, simulation: false, traitees: ok, erreurs })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erreur' }, { status: 500 })
  }
}
