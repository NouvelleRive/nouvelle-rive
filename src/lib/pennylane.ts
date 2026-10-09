// src/lib/pennylane.ts — client minimal de l'API publique Pennylane v2.
// Lecture seule (token « P&L admin »). Pennylane agrège déjà les banques
// (Shine, Compte Pro Pennylane/Swan…), c'est donc notre seule porte d'entrée
// pour le réel bancaire et pour la balance comptable.

const BASE = 'https://app.pennylane.com/api/external/v2'

export type BankAccount = {
  id: number
  name: string
  currency: string
  balance: string
  updated_at: string
}

export type TrialBalanceLine = {
  number: string
  label: string
  debits: string
  credits: string
}

export type FiscalYear = {
  id: number
  start: string
  finish: string
  status: string
}

function token() {
  const t = process.env.PENNYLANE_API_TOKEN
  if (!t) throw new Error('PENNYLANE_API_TOKEN manquant')
  return t
}

// Toutes les collections Pennylane v2 sont paginées par curseur.
async function listAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const out: T[] = []
  let cursor: string | null = null
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ ...params, limit: '100' })
    if (cursor) qs.set('cursor', cursor)
    const res = await fetch(`${BASE}/${path}?${qs}`, {
      headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Pennylane ${path} → ${res.status} ${await res.text()}`)
    const json = await res.json()
    out.push(...(json.items || []))
    if (!json.has_more) break
    cursor = json.next_cursor
  }
  return out
}

export const getBankAccounts = () => listAll<BankAccount>('bank_accounts')
export const getFiscalYears = () => listAll<FiscalYear>('fiscal_years')
export const getTrialBalance = (start: string, end: string) =>
  listAll<TrialBalanceLine>('trial_balance', { period_start: start, period_end: end })
