// app/api/admin/pnl/tri/route.ts
// Tri des transactions bancaires non affectées.
//
// GET  : les libellés récurrents sans catégorie, les règles, les catégories.
// POST : ajouter/supprimer une règle, ou appliquer les règles (= poser la
//        catégorie dans Pennylane). On ne touche QUE les transactions dont
//        `categories` est vide : rien de déjà trié n'est écrasé.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { getCategories, getTransactions, setTransactionCategories } from '@/lib/pennylane'
import { normaliserLibelle, sensDe, trouverRegle, type Regle } from '@/lib/pnlRegles'

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

async function lireRegles(): Promise<Regle[]> {
  const snap = await DOC().get()
  return (snap.exists ? (snap.data()?.regles as Regle[]) : []) || []
}

export async function GET(req: NextRequest) {
  const refus = await requireAdmin(req)
  if (refus) return refus

  try {
    const depuis = req.nextUrl.searchParams.get('depuis') || '2026-01-01'
    const [categories, transactions, regles] = await Promise.all([
      getCategories(), getTransactions(), lireRegles(),
    ])

    const periode = transactions.filter(t => t.date >= depuis)
    const sansCategorie = periode.filter(t => !t.categories?.length)

    // Regroupement par libellé normalisé : c'est l'unité de tri.
    const groupes = new Map<string, {
      libelle: string; exemple: string; nb: number; total: number
      sens: 'cash_in' | 'cash_out' | 'mixte'; regle: Regle | null
    }>()

    for (const t of sansCategorie) {
      const cle = normaliserLibelle(t.label) || '(sans libellé)'
      const montant = Number(t.amount) || 0
      const g = groupes.get(cle) || {
        libelle: cle,
        exemple: (t.label || '').replace(/\s+/g, ' ').trim(),
        nb: 0,
        total: 0,
        sens: sensDe(montant) as 'cash_in' | 'cash_out' | 'mixte',
        regle: trouverRegle(regles, t.label, montant),
      }
      g.nb += 1
      g.total += montant
      if (g.sens !== 'mixte' && g.sens !== sensDe(montant)) g.sens = 'mixte'
      groupes.set(cle, g)
    }

    const liste = [...groupes.values()].sort((a, b) => b.nb - a.nb)

    return NextResponse.json({
      success: true,
      depuis,
      categories,
      regles,
      stats: {
        transactions: periode.length,
        sansCategorie: sansCategorie.length,
        couvertesParUneRegle: liste.filter(g => g.regle).reduce((s, g) => s + g.nb, 0),
        groupes: liste.length,
      },
      groupes: liste,
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
    const regles = await lireRegles()

    if (body.action === 'ajouter-regle') {
      const { motif, categorieId, categorieLabel, sens } = body
      if (!motif || !categorieId) {
        return NextResponse.json({ success: false, error: 'motif et categorieId requis' }, { status: 400 })
      }
      const regle: Regle = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        motif: String(motif).trim(),
        categorieId: Number(categorieId),
        categorieLabel: String(categorieLabel || ''),
        sens: sens === 'cash_in' || sens === 'cash_out' ? sens : null,
        actif: true,
        creeLe: new Date().toISOString(),
      }
      await DOC().set({ regles: [...regles, regle] }, { merge: true })
      return NextResponse.json({ success: true, regle })
    }

    if (body.action === 'supprimer-regle') {
      await DOC().set({ regles: regles.filter(r => r.id !== body.id) }, { merge: true })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'appliquer') {
      const depuis = body.depuis || '2026-01-01'
      const limite = Number(body.limite) || 0 // 0 = tout
      const simulation = body.simulation !== false // par défaut on simule

      const transactions = await getTransactions()
      const cibles = transactions
        .filter(t => t.date >= depuis && !t.categories?.length)
        .map(t => ({ t, regle: trouverRegle(regles, t.label, Number(t.amount) || 0) }))
        .filter((x): x is { t: typeof transactions[0]; regle: Regle } => !!x.regle)

      const aTraiter = limite > 0 ? cibles.slice(0, limite) : cibles

      if (simulation) {
        return NextResponse.json({
          success: true,
          simulation: true,
          nb: aTraiter.length,
          apercu: aTraiter.slice(0, 20).map(x => ({
            id: x.t.id, date: x.t.date, libelle: x.t.label, montant: Number(x.t.amount),
            categorie: x.regle.categorieLabel,
          })),
        })
      }

      // Écriture réelle, en série pour ne pas marteler l'API.
      let ok = 0
      const erreurs: { id: number; erreur: string }[] = []
      for (const x of aTraiter) {
        try {
          await setTransactionCategories(x.t.id, [x.regle.categorieId])
          ok += 1
        } catch (e: any) {
          erreurs.push({ id: x.t.id, erreur: String(e?.message || e).slice(0, 200) })
          if (erreurs.length >= 10) break // on s'arrête si ça part en vrille
        }
      }
      return NextResponse.json({ success: true, simulation: false, traitees: ok, erreurs })
    }

    return NextResponse.json({ success: false, error: 'action inconnue' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erreur' }, { status: 500 })
  }
}
