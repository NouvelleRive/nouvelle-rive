// app/api/admin/pennylane/ecritures-nr/route.ts
// Écritures mensuelles de nos ventes de stock propre (NR et NR ACHATS).
//
// Ces ventes passent par Square mais ne donnent lieu à aucune facture
// chineuse : sans cette écriture, l'argent reste sur le compte de transit
// 511301 et n'est jamais reconnu en produit. On les crée depuis la page
// Paiements, au moment où on génère le XML des virements du mois.
//
// POST { mois: "MM-YYYY" }  → crée ce qui manque, ignore ce qui existe.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { AggregateField, Timestamp } from 'firebase-admin/firestore'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'
const BASE = 'https://app.pennylane.com/api/external/v2'
const JOURNAL_OD = 7154078
const COMPTE_TRANSIT = 11652336320512   // 511301 ENCAISSEMENTS SQUARE
const COMPTE_VENTES = 16755240902656    // 707 Ventes de marchandises

const LIBELLES: { trigramme: string; nom: string }[] = [
  { trigramme: 'NR', nom: 'NR' },
  { trigramme: 'ACH', nom: 'NR ACHATS' },
]

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

function penny(path: string, init?: RequestInit) {
  const t = process.env.PENNYLANE_API_TOKEN
  if (!t) throw new Error('PENNYLANE_API_TOKEN manquant')
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  })
}

export async function POST(req: NextRequest) {
  const refus = await requireAdmin(req)
  if (refus) return refus

  try {
    const { mois } = await req.json() as { mois?: string }
    const m = /^(\d{2})-(\d{4})$/.exec(mois || '')
    if (!m) return NextResponse.json({ success: false, error: 'mois attendu au format MM-YYYY' }, { status: 400 })
    const numMois = Number(m[1])
    const an = Number(m[2])

    const debut = new Date(an, numMois - 1, 1, 0, 0, 0)
    const fin = new Date(an, numMois, 0, 23, 59, 59, 999)
    const dateEcriture = `${an}-${m[1]}-${String(fin.getDate()).padStart(2, '0')}`
    const libelleMois = debut.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    // Les écritures déjà passées sur ce mois, pour ne rien créer en double.
    const existantes = await penny(
      `/ledger_entries?limit=100&filter=${encodeURIComponent(JSON.stringify([
        { field: 'date', operator: 'gteq', value: dateEcriture },
        { field: 'date', operator: 'lteq', value: dateEcriture },
      ]))}`,
    ).then(r => (r.ok ? r.json() : { items: [] }))
    const labelsExistants: string[] = (existantes.items || []).map((e: any) => (e.label || '').replace(/\s+/g, ' ').trim())

    const resultats: { nom: string; montant: number; etat: string }[] = []

    for (const { trigramme, nom } of LIBELLES) {
      const base = adminDb.collection('ventes')
        .where('trigramme', '==', trigramme)
        .where('dateVente', '>=', Timestamp.fromDate(debut))
        .where('dateVente', '<=', Timestamp.fromDate(fin))
      const montant = await base.aggregate({ ca: AggregateField.sum('prixVenteReel') }).get()
        .then(s => Math.round((s.data().ca || 0) * 100) / 100)
        .catch(() => 0)

      const label = `Ventes stock maison ${nom} - ${libelleMois}`
      if (montant <= 0) { resultats.push({ nom, montant, etat: 'aucune vente' }); continue }
      if (labelsExistants.includes(label)) { resultats.push({ nom, montant, etat: 'déjà passée' }); continue }

      const res = await penny('/ledger_entries', {
        method: 'POST',
        body: JSON.stringify({
          date: dateEcriture,
          label,
          journal_id: JOURNAL_OD,
          ledger_entry_lines: [
            { ledger_account_id: COMPTE_TRANSIT, debit: montant.toFixed(2), credit: '0.00' },
            { ledger_account_id: COMPTE_VENTES, debit: '0.00', credit: montant.toFixed(2) },
          ],
        }),
      })
      resultats.push({ nom, montant, etat: res.ok ? 'créée' : `erreur ${res.status} ${(await res.text()).slice(0, 120)}` })
    }

    return NextResponse.json({ success: true, mois: libelleMois, date: dateEcriture, resultats })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'erreur' }, { status: 500 })
  }
}
