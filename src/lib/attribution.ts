'use client'

// Attribution marketing — UTM + identifiants de clic Meta (fbclid / _fbp / _fbc).
// Persistés en first-party (localStorage) pour :
//   1. croiser session → vente (d'où vient l'acheteur : Insta, Google…),
//   2. alimenter le CAPI serveur (déduplication + matching avancé).
// La capture UTM est first-party (comme Backstage). Les identifiants Meta
// (_fbp/_fbc) ne sont transmis à Meta que si le consentement est accordé.

const KEY = 'nr-attribution'
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

export type Attribution = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  fbclid?: string
  landing?: string
  ts?: number
}

/** À appeler à chaque arrivée sur une page. Ne réécrit que si de nouveaux UTM arrivent. */
export function captureAttribution() {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const incoming: Attribution = {}
    let has = false
    for (const f of UTM_FIELDS) {
      const v = params.get(f)
      if (v) {
        incoming[f] = v.slice(0, 120)
        has = true
      }
    }
    const fbclid = params.get('fbclid')
    if (fbclid) {
      incoming.fbclid = fbclid.slice(0, 255)
      has = true
    }
    if (!has) return // pas de nouveaux paramètres → on garde le first-touch existant
    incoming.landing = window.location.pathname
    incoming.ts = Date.now()
    localStorage.setItem(KEY, JSON.stringify(incoming))
  } catch {
    /* ignore */
  }
}

export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Attribution) : {}
  } catch {
    return {}
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]+)'))
  return m ? decodeURIComponent(m[2]) : undefined
}

/** Cookies _fbp / _fbc posés par le Pixel — nécessaires au matching CAPI. */
export function getFbCookies(): { fbp?: string; fbc?: string } {
  const fbp = readCookie('_fbp')
  let fbc = readCookie('_fbc')
  // Pas de _fbc mais un fbclid mémorisé → on le reconstruit au format Meta.
  if (!fbc) {
    const attr = getAttribution()
    if (attr.fbclid) fbc = `fb.1.${attr.ts || Date.now()}.${attr.fbclid}`
  }
  return { fbp, fbc }
}

/** event_id partagé navigateur ↔ serveur pour dédupliquer la Purchase. */
export function purchaseEventId(orderId: string): string {
  return `purchase_${orderId}`
}
