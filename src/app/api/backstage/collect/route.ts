// app/api/backstage/collect/route.ts
// Reçoit l'état COMPLET d'une session visiteur (envoyé par sendBeacon quand
// l'onglet passe en arrière-plan). Le serveur compare avec ce qu'il avait déjà
// stocké et n'incrémente que le delta dans le doc du jour.
//
// Coût Firestore : 1 read + 2 writes par flush (~2 flush par visiteur).
// Aucune écriture par page vue → reste très largement dans le free tier.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebaseAdmin'

const JOURS = 'backstage_jours'
const SESSIONS = 'backstage_sessions'

// Les clés de map Firestore n'acceptent ni "/" ni "." : on encode.
// La valeur d'origine est conservée dans le champ `p` / `q` pour l'affichage.
function encKey(s: string) {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140) || '_'
}

function dayKey(ts: number) {
  // Journée calendaire Europe/Paris
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}

// Localisation : Vercel pose ces en-têtes sur chaque requête, gratuitement.
// Aucun service tiers, aucune IP stockée — seulement ville + pays agrégés.
function geoFrom(req: NextRequest) {
  const dec = (h: string) => {
    const raw = req.headers.get(h)
    if (!raw) return ''
    try {
      return decodeURIComponent(raw).slice(0, 60)
    } catch {
      return raw.slice(0, 60)
    }
  }
  const pays = dec('x-vercel-ip-country').toUpperCase()
  const ville = dec('x-vercel-ip-city')
  return { pays, ville }
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function str(v: unknown, max = 200) {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

// --- Garde-fou anti-spam ---------------------------------------------------
// L'endpoint est forcément public (sendBeacon depuis le navigateur, sans auth).
// Sans limite, une boucle POST génère des writes Firestore facturables.
// Compteur en mémoire par IP : imparfait en serverless (une Map par instance),
// mais ça coupe la boucle naïve pour 0€ et 0 read supplémentaire.
const RL_WINDOW_MS = 10 * 60 * 1000
const RL_MAX = 60 // ~2 flush/visiteur : 60 laisse passer un usage normal partagé
const hits = new Map<string, { n: number; resetAt: number }>()

function rateLimited(ip: string) {
  const now = Date.now()
  // Purge opportuniste pour que la Map ne grossisse pas indéfiniment.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k)
  }
  const cur = hits.get(ip)
  if (!cur || cur.resetAt < now) {
    hits.set(ip, { n: 1, resetAt: now + RL_WINDOW_MS })
    return false
  }
  cur.n += 1
  return cur.n > RL_MAX
}

export async function POST(req: NextRequest) {
  try {
    // Les bots ne sont pas des visiteurs : ni stats fausses, ni writes.
    const ua = req.headers.get('user-agent') || ''
    if (!ua || /bot|crawl|spider|slurp|headless|curl|wget|python-requests|axios|scrapy|lighthouse|preview/i.test(ua)) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    if (rateLimited(ip)) {
      return NextResponse.json({ ok: false }, { status: 429 })
    }

    const body = await req.json()
    const sid = str(body?.sid, 60)
    if (!sid || !/^[a-zA-Z0-9-]+$/.test(sid)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // --- Normalisation de ce que le navigateur nous envoie ---
    const pagesIn: Record<string, { p: string; v: number; ms: number }> = {}
    const rawPages = body?.pages && typeof body.pages === 'object' ? body.pages : {}
    for (const key of Object.keys(rawPages).slice(0, 120)) {
      const item = rawPages[key]
      const p = str(item?.p || key, 160)
      if (!p.startsWith('/')) continue
      pagesIn[encKey(p)] = { p, v: num(item?.v), ms: Math.min(num(item?.ms), 30 * 60 * 1000) }
    }

    const searchesIn: string[] = Array.isArray(body?.searches)
      ? body.searches.slice(0, 40).map((s: unknown) => str(s, 60).toLowerCase()).filter(Boolean)
      : []

    const incoming = {
      sid,
      device: body?.device === 'mobile' ? 'mobile' : 'desktop',
      ref: str(body?.ref, 80) || 'direct',
      lang: str(body?.lang, 5) || 'fr',
      start: num(body?.start) || Date.now(),
      pages: pagesIn,
      order: Array.isArray(body?.order) ? body.order.slice(0, 60).map((s: unknown) => str(s, 160)) : [],
      searches: searchesIn,
      addToCart: num(body?.addToCart),
      checkoutStart: num(body?.checkoutStart),
      conversions: num(body?.conversions),
      revenue: num(body?.revenue),
      exit: str(body?.exit, 160),
    }

    const day = dayKey(incoming.start)
    const sessionRef = adminDb.collection(SESSIONS).doc(sid)
    const snap = await sessionRef.get()
    const prev = snap.exists ? (snap.data() as Record<string, unknown>) : null
    const first = !prev

    const prevPages = (prev?.pages as typeof pagesIn) || {}
    const prevSearches = (prev?.searches as string[]) || []

    // --- Delta à appliquer sur l'agrégat du jour ---
    const agg: Record<string, unknown> = { day, updatedAt: Date.now() }
    const pagesDelta: Record<string, unknown> = {}
    let viewsDelta = 0

    for (const k of Object.keys(incoming.pages)) {
      const now = incoming.pages[k]
      const old = prevPages[k]
      const dv = now.v - num(old?.v)
      const dms = now.ms - num(old?.ms)
      if (dv <= 0 && dms <= 0) continue
      const patch: Record<string, unknown> = { p: now.p }
      if (dv > 0) {
        patch.v = FieldValue.increment(dv)
        viewsDelta += dv
      }
      if (dms > 0) patch.ms = FieldValue.increment(dms)
      pagesDelta[k] = patch
    }
    if (Object.keys(pagesDelta).length) agg.pages = pagesDelta
    if (viewsDelta > 0) agg.pageviews = FieldValue.increment(viewsDelta)

    // Nouveaux mots recherchés depuis le dernier flush
    const newSearches = incoming.searches.slice(prevSearches.length)
    if (newSearches.length) {
      const counts = new Map<string, { q: string; n: number }>()
      for (const term of newSearches) {
        const k = encKey(term)
        const cur = counts.get(k)
        if (cur) cur.n += 1
        else counts.set(k, { q: term, n: 1 })
      }
      const sDelta: Record<string, unknown> = {}
      for (const [k, { q, n }] of counts) {
        sDelta[k] = { q, n: FieldValue.increment(n) }
      }
      agg.searches = sDelta
      agg.searchCount = FieldValue.increment(newSearches.length)
    }

    // Compteurs entonnoir
    const counters: Array<[string, number]> = [
      ['addToCart', incoming.addToCart - num(prev?.addToCart)],
      ['checkoutStart', incoming.checkoutStart - num(prev?.checkoutStart)],
      ['conversions', incoming.conversions - num(prev?.conversions)],
      ['revenue', incoming.revenue - num(prev?.revenue)],
    ]
    for (const [field, d] of counters) {
      if (d > 0) agg[field] = FieldValue.increment(d)
    }

    // Première visite de la session : on compte la session, l'appareil,
    // la provenance et la page d'entrée.
    if (first) {
      agg.sessions = FieldValue.increment(1)
      agg.devices = { [incoming.device]: FieldValue.increment(1) }
      agg.refs = { [encKey(incoming.ref)]: { p: incoming.ref, n: FieldValue.increment(1) } }
      const entry = incoming.order[0] || incoming.exit
      if (entry) agg.entries = { [encKey(entry)]: { p: entry, n: FieldValue.increment(1) } }

      const { pays, ville } = geoFrom(req)
      if (pays) agg.pays = { [encKey(pays)]: { p: pays, n: FieldValue.increment(1) } }
      if (ville) {
        const label = pays ? `${ville}|${pays}` : ville
        agg.villes = { [encKey(label)]: { p: label, n: FieldValue.increment(1) } }
      }
    }

    // Page de sortie : si elle a changé depuis le dernier flush, on décrémente
    // l'ancienne et on incrémente la nouvelle. Le total reste exact.
    const prevExit = str(prev?.exit, 160)
    if (incoming.exit && incoming.exit !== prevExit) {
      const exits: Record<string, unknown> = {
        [encKey(incoming.exit)]: { p: incoming.exit, n: FieldValue.increment(1) },
      }
      if (prevExit) exits[encKey(prevExit)] = { p: prevExit, n: FieldValue.increment(-1) }
      agg.exits = exits
    }

    const batch = adminDb.batch()
    batch.set(adminDb.collection(JOURS).doc(day), agg, { merge: true })
    batch.set(
      sessionRef,
      {
        ...incoming,
        day,
        last: Date.now(),
        // expireAt : à brancher sur une règle TTL Firestore (90 jours) pour que
        // la collection se purge toute seule et reste gratuite.
        expireAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
      },
      { merge: true }
    )
    await batch.commit()

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[backstage/collect]', e)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
