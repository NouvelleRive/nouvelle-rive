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

export type Transaction = {
  id: number
  date: string
  label: string
  amount: string
  currency: string
  bank_account: { id: number }
  categories: { id: number; label?: string }[]
}

export type Categorie = {
  id: number
  label: string
  direction: 'cash_in' | 'cash_out'
  category_group: { id: number }
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

const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

// Pennylane limite le débit : on réessaie sur 429 au lieu de tomber.
async function appel(url: string): Promise<Response> {
  for (let essai = 0; essai < 6; essai++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (res.status !== 429) return res
    await pause(1200 * (essai + 1))
  }
  throw new Error('Pennylane : limite de débit atteinte malgré les réessais')
}

// Toutes les collections Pennylane v2 sont paginées par curseur.
async function listAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const out: T[] = []
  let cursor: string | null = null
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ ...params, limit: '100' })
    if (cursor) qs.set('cursor', cursor)
    const res = await appel(`${BASE}/${path}?${qs}`)
    if (!res.ok) throw new Error(`Pennylane ${path} → ${res.status} ${await res.text()}`)
    const json = await res.json()
    out.push(...(json.items || []))
    if (!json.has_more) break
    cursor = json.next_cursor
    await pause(250)
  }
  return out
}

export const getBankAccounts = () => listAll<BankAccount>('bank_accounts')
export const getCategories = () => listAll<Categorie>('categories')
export const getTransactions = () => listAll<Transaction>('transactions')
export const getFiscalYears = () => listAll<FiscalYear>('fiscal_years')
export const getTrialBalance = (start: string, end: string) =>
  listAll<TrialBalanceLine>('trial_balance', { period_start: start, period_end: end })

// Pose les catégories d'une transaction. Seule écriture que le token autorise.
// Pennylane exige que la somme des poids d'un même groupe fasse 1.
export async function setTransactionCategories(transactionId: number, categorieIds: number[]) {
  const body = JSON.stringify(categorieIds.map(id => ({ id, weight: String(1 / categorieIds.length) })))
  for (let essai = 0; essai < 6; essai++) {
    const res = await fetch(`${BASE}/transactions/${transactionId}/categories`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token()}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body,
    })
    if (res.status === 429) { await pause(1200 * (essai + 1)); continue }
    if (!res.ok) throw new Error(`Pennylane PUT categories ${transactionId} → ${res.status} ${await res.text()}`)
    return res.json()
  }
  throw new Error(`Pennylane PUT categories ${transactionId} : limite de débit atteinte`)
}
