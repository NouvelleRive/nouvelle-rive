'use client'

// Backstage — mini-analytics maison, zéro dépendance, zéro facture.
// Principe : tout s'accumule côté navigateur dans sessionStorage.
// On envoie l'état COMPLET de la session au serveur seulement quand
// l'onglet passe en arrière-plan / se ferme. Le serveur fait le diff.
// => ~2 requêtes par visiteur, pas une par page vue.

const KEY = 'nr-bs-session'
const OPTOUT_KEY = 'nr-no-track'
const ENDPOINT = '/api/backstage/collect'
const MAX_SEARCHES = 40
const MAX_ORDER = 60

export type BackstageState = {
  sid: string
  start: number
  device: 'mobile' | 'desktop'
  ref: string
  lang: string
  pages: Record<string, { p: string; v: number; ms: number }>
  order: string[]
  searches: string[]
  addToCart: number
  checkoutStart: number
  conversions: number
  revenue: number
  exit: string
}

let state: BackstageState | null = null
let activePath = ''
let activeSince = 0
let listenersReady = false

function optedOut() {
  try {
    if (localStorage.getItem(OPTOUT_KEY) === '1') return true
  } catch {
    /* storage bloqué */
  }
  const h = location.hostname
  return h === 'localhost' || h === '127.0.0.1'
}

function newSid() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function referrerHost() {
  try {
    if (!document.referrer) return 'direct'
    const u = new URL(document.referrer)
    if (u.hostname === location.hostname) return 'direct'
    return u.hostname.replace(/^www\./, '')
  } catch {
    return 'direct'
  }
}

function load(): BackstageState {
  if (state) return state
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.sid) {
        state = parsed as BackstageState
        return state
      }
    }
  } catch {
    /* ignore */
  }
  state = {
    sid: newSid(),
    start: Date.now(),
    device: window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop',
    ref: referrerHost(),
    lang: (navigator.language || 'fr').slice(0, 2),
    pages: {},
    order: [],
    searches: [],
    addToCart: 0,
    checkoutStart: 0,
    conversions: 0,
    revenue: 0,
    exit: '',
  }
  return state
}

function save() {
  if (!state) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

// Fige le temps passé sur la page en cours dans l'état.
function settleTime() {
  if (!state || !activePath || !activeSince) return
  const elapsed = Date.now() - activeSince
  activeSince = Date.now()
  if (elapsed <= 0 || elapsed > 30 * 60 * 1000) return
  const entry = state.pages[activePath]
  if (entry) entry.ms += elapsed
}

function flush() {
  if (!state) return
  settleTime()
  save()
  const body = JSON.stringify(state)
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
      return
    }
  } catch {
    /* fallback */
  }
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

function ensureListeners() {
  if (listenersReady) return
  listenersReady = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush()
    } else {
      activeSince = Date.now()
    }
  })
  window.addEventListener('pagehide', flush)
}

export function trackPage(path: string) {
  if (typeof window === 'undefined' || optedOut()) return
  const s = load()
  settleTime()

  activePath = path
  activeSince = Date.now()
  s.exit = path

  if (!s.pages[path]) s.pages[path] = { p: path, v: 0, ms: 0 }
  s.pages[path].v += 1
  if (s.order[s.order.length - 1] !== path && s.order.length < MAX_ORDER) s.order.push(path)

  save()
  ensureListeners()
}

function bump(field: 'addToCart' | 'checkoutStart' | 'conversions', by = 1) {
  if (typeof window === 'undefined' || optedOut()) return
  const s = load()
  s[field] += by
  save()
}

export function trackSearch(term: string) {
  if (typeof window === 'undefined' || optedOut()) return
  const clean = term.trim().toLowerCase().slice(0, 60)
  if (!clean) return
  const s = load()
  if (s.searches.length >= MAX_SEARCHES) return
  s.searches.push(clean)
  save()
}

export function trackAddToCart() {
  bump('addToCart')
}

export function trackCheckoutStart() {
  bump('checkoutStart')
}

// Appelé une seule fois par commande (dédoublonné via localStorage sur l'orderId).
export function trackConversion(orderId: string, montant: number) {
  if (typeof window === 'undefined' || optedOut()) return
  try {
    const seen = `nr-bs-conv-${orderId}`
    if (localStorage.getItem(seen)) return
    localStorage.setItem(seen, '1')
  } catch {
    /* ignore */
  }
  const s = load()
  s.conversions += 1
  s.revenue += Math.round(montant || 0)
  save()
  flush()
}
