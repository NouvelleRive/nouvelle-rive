'use client'

// Meta Pixel — chargé UNIQUEMENT après consentement (voir lib/consent + ConsentBanner).
// Aucun script tiers n'est injecté tant que l'utilisateur n'a pas accepté.
// Les évènements qui ont un pendant serveur (CAPI) partagent un event_id
// pour que Meta déduplique navigateur ↔ serveur.

import { PIXEL_ID } from './consent'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    fbq?: any
    _fbq?: any
  }
}

let scriptLoaded = false
let inited = false

function loadScript() {
  if (scriptLoaded || typeof window === 'undefined') return
  if (window.fbq) {
    scriptLoaded = true
    return
  }
  // Snippet officiel Meta (inline, zéro dépendance npm)
  ;(function (f: any, b: any, e: string, v: string, n?: any, t?: any, s?: any) {
    if (f.fbq) return
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    }
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    t = b.createElement(e)
    t.async = true
    t.src = v
    s = b.getElementsByTagName(e)[0]
    s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  scriptLoaded = true
}

/** À appeler une fois le consentement accordé. Idempotent. */
export function initPixel() {
  if (!PIXEL_ID || typeof window === 'undefined') return
  loadScript()
  if (!inited && window.fbq) {
    window.fbq('init', PIXEL_ID)
    inited = true
  }
}

function ready(): boolean {
  return !!PIXEL_ID && typeof window !== 'undefined' && !!window.fbq && inited
}

export function pixelPageView() {
  if (!ready()) return
  window.fbq('track', 'PageView')
}

export function pixelViewContent(p: { id: string; value: number; name?: string }) {
  if (!ready()) return
  window.fbq('track', 'ViewContent', {
    content_ids: [p.id],
    content_type: 'product',
    content_name: p.name,
    value: Number(p.value) || 0,
    currency: 'EUR',
  })
}

export function pixelAddToCart(p: { id: string; value: number; name?: string }) {
  if (!ready()) return
  window.fbq('track', 'AddToCart', {
    content_ids: [p.id],
    content_type: 'product',
    content_name: p.name,
    value: Number(p.value) || 0,
    currency: 'EUR',
  })
}

export function pixelInitiateCheckout(p: { ids: string[]; value: number }) {
  if (!ready()) return
  window.fbq('track', 'InitiateCheckout', {
    content_ids: p.ids,
    content_type: 'product',
    num_items: p.ids.length,
    value: Number(p.value) || 0,
    currency: 'EUR',
  })
}

/** eventId doit être identique côté serveur (CAPI) pour la déduplication. */
export function pixelPurchase(p: { eventId: string; ids: string[]; value: number }) {
  if (!ready()) return
  window.fbq(
    'track',
    'Purchase',
    {
      content_ids: p.ids,
      content_type: 'product',
      value: Number(p.value) || 0,
      currency: 'EUR',
    },
    { eventID: p.eventId }
  )
}
