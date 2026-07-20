// app/api/backstage/stats/route.ts
// Lecture du backstage : agrège les docs journaliers sur une période.
// Coût : 1 read par jour demandé (30 reads pour un mois), rien de plus.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'

const JOURS = 'backstage_jours'
const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

type Bucket = { p?: string; q?: string; v?: number; ms?: number; n?: number }

function parisDayKey(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}

function lastDays(n: number) {
  const out: string[] = []
  const now = Date.now()
  for (let i = n - 1; i >= 0; i--) {
    out.push(parisDayKey(new Date(now - i * 24 * 3600 * 1000)))
  }
  return out
}

function mergeBuckets(
  target: Map<string, { label: string; v: number; ms: number; n: number }>,
  src: Record<string, Bucket> | undefined
) {
  if (!src) return
  for (const key of Object.keys(src)) {
    const b = src[key] || {}
    const label = b.p || b.q || key
    const cur = target.get(label) || { label, v: 0, ms: 0, n: 0 }
    cur.v += Number(b.v) || 0
    cur.ms += Number(b.ms) || 0
    cur.n += Number(b.n) || 0
    target.set(label, cur)
  }
}

function toList(m: Map<string, { label: string; v: number; ms: number; n: number }>) {
  return [...m.values()]
}

// "FR" -> "France". Intl est natif : aucune table à maintenir.
const nomsPays = new Intl.DisplayNames(['fr'], { type: 'region' })
function nomPays(code: string) {
  try {
    return nomsPays.of(code) || code
  } catch {
    return code
  }
}

export async function GET(req: NextRequest) {
  try {
    // --- Auth admin ---
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1), 90)
    const keys = lastDays(days)

    const refs = keys.map((k) => adminDb.collection(JOURS).doc(k))
    const snaps = await adminDb.getAll(...refs)

    const totals = {
      sessions: 0,
      pageviews: 0,
      addToCart: 0,
      checkoutStart: 0,
      conversions: 0,
      revenue: 0,
      searchCount: 0,
    }
    const parJour: Array<{ day: string; sessions: number; pageviews: number; conversions: number; revenue: number }> = []
    const pages = new Map<string, { label: string; v: number; ms: number; n: number }>()
    const exits = new Map<string, { label: string; v: number; ms: number; n: number }>()
    const entries = new Map<string, { label: string; v: number; ms: number; n: number }>()
    const searches = new Map<string, { label: string; v: number; ms: number; n: number }>()
    const sources = new Map<string, { label: string; v: number; ms: number; n: number }>()
    const villes = new Map<string, { label: string; v: number; ms: number; n: number }>()
    const pays = new Map<string, { label: string; v: number; ms: number; n: number }>()
    const devices = { mobile: 0, desktop: 0 }

    snaps.forEach((snap, i) => {
      const d = (snap.exists ? snap.data() : {}) as Record<string, unknown>
      const sessions = Number(d.sessions) || 0
      const pv = Number(d.pageviews) || 0
      const conv = Number(d.conversions) || 0
      const rev = Number(d.revenue) || 0

      totals.sessions += sessions
      totals.pageviews += pv
      totals.addToCart += Number(d.addToCart) || 0
      totals.checkoutStart += Number(d.checkoutStart) || 0
      totals.conversions += conv
      totals.revenue += rev
      totals.searchCount += Number(d.searchCount) || 0

      parJour.push({ day: keys[i], sessions, pageviews: pv, conversions: conv, revenue: rev })

      mergeBuckets(pages, d.pages as Record<string, Bucket>)
      mergeBuckets(exits, d.exits as Record<string, Bucket>)
      mergeBuckets(entries, d.entries as Record<string, Bucket>)
      mergeBuckets(searches, d.searches as Record<string, Bucket>)
      mergeBuckets(sources, d.refs as Record<string, Bucket>)
      mergeBuckets(villes, d.villes as Record<string, Bucket>)
      mergeBuckets(pays, d.pays as Record<string, Bucket>)

      const dev = (d.devices as Record<string, number>) || {}
      devices.mobile += Number(dev.mobile) || 0
      devices.desktop += Number(dev.desktop) || 0
    })

    const pagesList = toList(pages)
      .map((p) => ({
        page: p.label,
        vues: p.v,
        tempsMoyenMs: p.v > 0 ? Math.round(p.ms / p.v) : 0,
        tempsTotalMs: p.ms,
      }))
      .sort((a, b) => b.vues - a.vues)

    return NextResponse.json(
      {
        days,
        totals,
        parJour,
        devices,
        pages: pagesList.slice(0, 60),
        // Pages où l'on reste le plus longtemps : on écarte le bruit statistique
        // en exigeant au moins 3 vues sur la période.
        pagesLongues: [...pagesList]
          .filter((p) => p.vues >= 3)
          .sort((a, b) => b.tempsMoyenMs - a.tempsMoyenMs)
          .slice(0, 20),
        sorties: toList(exits)
          .map((e) => ({ page: e.label, n: e.n }))
          .filter((e) => e.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 20),
        entrees: toList(entries)
          .map((e) => ({ page: e.label, n: e.n }))
          .filter((e) => e.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 20),
        recherches: toList(searches)
          .map((s) => ({ terme: s.label, n: s.n }))
          .filter((s) => s.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 60),
        sources: toList(sources)
          .map((s) => ({ source: s.label, n: s.n }))
          .filter((s) => s.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 20),
        villes: toList(villes)
          .map((v) => {
            const [ville, code] = v.label.split('|')
            return { ville: code ? `${ville} (${nomPays(code)})` : ville, n: v.n }
          })
          .filter((v) => v.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 30),
        pays: toList(pays)
          .map((p) => ({ pays: nomPays(p.label), n: p.n }))
          .filter((p) => p.n > 0)
          .sort((a, b) => b.n - a.n)
          .slice(0, 20),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('[backstage/stats]', e)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
