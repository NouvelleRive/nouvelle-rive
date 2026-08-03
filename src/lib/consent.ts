'use client'

// Consentement cookies publicitaires (CNIL/RGPD).
// Le Pixel Meta et le CAPI ne se déclenchent QUE si l'utilisateur a accepté.
// Tant qu'aucun ID de Pixel n'est configuré, il n'y a aucun cookie pub → pas
// de bannière, pas de traceur : toute la couche reste dormante.

const KEY = 'nr-consent'

export const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || ''

export function pixelConfigured(): boolean {
  return !!PIXEL_ID
}

export type ConsentValue = 'granted' | 'denied'

export function getConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

export function setConsent(v: ConsentValue) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* storage bloqué */
  }
}

export function marketingAllowed(): boolean {
  return pixelConfigured() && getConsent() === 'granted'
}
