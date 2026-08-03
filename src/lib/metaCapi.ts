// Meta Conversions API (CAPI) — envoi serveur des évènements Purchase.
// Complément du Pixel navigateur : le paiement se finalise sur la page hébergée
// Square (le navigateur quitte le site), donc la conversion fiable vient du
// webhook serveur. La déduplication avec le Pixel se fait via event_id partagé.
//
// No-op silencieux tant que META_CAPI_ACCESS_TOKEN + Pixel ne sont pas configurés
// → aucun risque de casse tant que la config n'est pas en place.

import crypto from 'crypto'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || process.env.META_PIXEL_ID || ''
const TOKEN = process.env.META_CAPI_ACCESS_TOKEN || ''
const API_VERSION = 'v21.0'

function hash(v?: string | null): string | undefined {
  if (!v) return undefined
  const clean = v.trim().toLowerCase()
  if (!clean) return undefined
  return crypto.createHash('sha256').update(clean).digest('hex')
}

export type CapiPurchase = {
  eventId: string
  eventTimeMs?: number
  value: number
  contentIds: string[]
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  fbp?: string
  fbc?: string
  sourceUrl?: string
}

export function capiConfigured(): boolean {
  return !!PIXEL_ID && !!TOKEN
}

export async function sendCapiPurchase(p: CapiPurchase): Promise<void> {
  if (!capiConfigured()) return

  const userData: Record<string, unknown> = {}
  const em = hash(p.email)
  if (em) userData.em = [em]
  const ph = hash(p.phone?.replace(/[^\d]/g, ''))
  if (ph) userData.ph = [ph]
  const fn = hash(p.firstName)
  if (fn) userData.fn = [fn]
  const ln = hash(p.lastName)
  if (ln) userData.ln = [ln]
  if (p.fbp) userData.fbp = p.fbp
  if (p.fbc) userData.fbc = p.fbc

  const event = {
    event_name: 'Purchase',
    event_time: Math.floor((p.eventTimeMs || Date.now()) / 1000),
    event_id: p.eventId,
    action_source: 'website',
    event_source_url: p.sourceUrl,
    user_data: userData,
    custom_data: {
      currency: 'EUR',
      value: Number(p.value.toFixed(2)),
      content_type: 'product',
      content_ids: p.contentIds,
    },
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [event] }),
      }
    )
    if (!res.ok) {
      const txt = await res.text()
      console.error('⚠️ CAPI Purchase KO:', res.status, txt.slice(0, 300))
    } else {
      console.log('✅ CAPI Purchase envoyée:', p.eventId)
    }
  } catch (e: unknown) {
    console.error('⚠️ CAPI Purchase exception:', (e as Error)?.message)
  }
}
