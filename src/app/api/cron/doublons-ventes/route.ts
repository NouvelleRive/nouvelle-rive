// app/api/cron/doublons-ventes/route.ts
// Contrôle mensuel des doublons de ventes, appelé le dernier jour du mois par
// le cron quotidien (functions/index.js). Trois cas remontés :
//
//   1. même ligne Square (lineItemUid) enregistrée sur deux commandes
//      → le ticket a été repassé en caisse, la clé orderId_lineItemUid ne voit rien ;
//   2. même pièce unique vendue deux fois à moins d'une heure ;
//   3. vente adossée à un paiement Square jamais encaissé ou remboursé.
//
// Un mail part seulement s'il y a quelque chose à signaler.
// `dryRun=1` en query → renvoie le rapport sans envoyer le mail.

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import { adminDb } from '@/lib/firebaseAdmin'

const CRON_SECRET = process.env.CRON_SECRET
const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'
const resend = new Resend(process.env.RESEND_API_KEY)

const SQUARE_BASE =
  process.env.SQUARE_ENV === 'sandbox'
    ? 'https://connect.squareupsandbox.com/v2'
    : 'https://connect.squareup.com/v2'

type Vente = {
  id: string
  sku?: string
  produitId?: string
  orderId?: string
  paymentId?: string
  lineItemUid?: string
  prixVenteReel?: number
  source?: string
  dateVente?: Timestamp
}

const quand = (v: Vente) =>
  v.dateVente?.toDate?.().toISOString().slice(0, 16).replace('T', ' ') ?? '?'
const ms = (v: Vente) => v.dateVente?.toDate?.().getTime() ?? 0

// Tous les paiements Square de la période, en une poignée d'appels.
async function paiementsDepuis(debut: Date): Promise<Map<string, any>> {
  const token = process.env.SQUARE_ACCESS_TOKEN
  const out = new Map<string, any>()
  if (!token) return out
  let cursor: string | undefined
  do {
    const url =
      `${SQUARE_BASE}/payments?begin_time=${debut.toISOString()}&limit=100` +
      (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '')
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2024-10-17' },
    })
    if (!res.ok) {
      console.warn('⚠️ ListPayments KO:', res.status)
      break
    }
    const j = await res.json()
    for (const p of j.payments || []) out.set(p.id, p)
    cursor = j.cursor
  } while (cursor)
  return out
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  const now = new Date()
  const debut = new Date(now.getFullYear(), now.getMonth(), 1)
  const snap = await adminDb
    .collection('ventes')
    .where('dateVente', '>=', Timestamp.fromDate(debut))
    .get()
  const ventes: Vente[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }))

  // 1. même ligne Square sur deux commandes
  const parLigne = new Map<string, Vente[]>()
  for (const v of ventes) {
    if (!v.lineItemUid) continue
    const l = parLigne.get(v.lineItemUid) || []
    l.push(v)
    parLigne.set(v.lineItemUid, l)
  }
  const lignesDoubles = [...parLigne.values()].filter((l) => l.length > 1)

  // 2. même pièce unique vendue deux fois à moins d'une heure
  const parSku = new Map<string, Vente[]>()
  for (const v of ventes) {
    const k = v.sku || v.produitId
    if (!k) continue
    const l = parSku.get(k) || []
    l.push(v)
    parSku.set(k, l)
  }
  const rapprochees: Vente[][] = []
  for (const [sku, l] of parSku) {
    if (l.length < 2) continue
    if (!(await adminDb.collection('produits').doc(sku).get()).exists) continue // article Square, pas une pièce unique
    l.sort((a, b) => ms(a) - ms(b))
    for (let i = 1; i < l.length; i++) {
      if (ms(l[i]) - ms(l[i - 1]) < 3_600_000) rapprochees.push([l[i - 1], l[i]])
    }
  }

  // 3. paiement jamais encaissé ou remboursé
  const paiements = await paiementsDepuis(debut)
  const paiementsKO: { v: Vente; statut: string }[] = []
  for (const v of ventes) {
    if (!v.paymentId) continue
    const p = paiements.get(v.paymentId)
    if (!p) continue
    if (p.status === 'COMPLETED' && !p.refunded_money?.amount) continue
    paiementsKO.push({ v, statut: p.refunded_money?.amount ? `remboursé ${p.refunded_money.amount / 100} €` : p.status })
  }

  const total = lignesDoubles.length + rapprochees.length + paiementsKO.length
  const bloc = (titre: string, lignes: string[]) =>
    lignes.length ? `<p><strong>${titre}</strong><br>${lignes.join('<br>')}</p>` : ''
  const html =
    bloc(
      'Même ligne de caisse enregistrée deux fois',
      lignesDoubles.map((l) => `${l[0].sku} — ${l.map((v) => `${quand(v)} (${v.orderId})`).join(' / ')}`),
    ) +
    bloc(
      'Pièce unique vendue deux fois à moins d’une heure',
      rapprochees.map(([a, b]) => `${a.sku} — ${quand(a)} et ${quand(b)} — ${a.prixVenteReel} €`),
    ) +
    bloc(
      'Vente sur paiement non encaissé ou remboursé',
      paiementsKO.map(({ v, statut }) => `${v.sku} — ${quand(v)} — ${v.prixVenteReel} € — ${statut}`),
    )

  if (total && !dryRun) {
    await resend.emails.send({
      from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
      to: ADMIN_EMAIL,
      subject: `${total} vente${total > 1 ? 's' : ''} à vérifier ce mois-ci`,
      html: `${html}<p>À vérifier avant de lancer les reversements.</p>`,
    })
  }

  return NextResponse.json({
    success: true,
    ventesExaminees: ventes.length,
    lignesDoubles: lignesDoubles.length,
    rapprochees: rapprochees.length,
    paiementsKO: paiementsKO.length,
    mailEnvoye: Boolean(total) && !dryRun,
    html: dryRun ? html : undefined,
  })
}
