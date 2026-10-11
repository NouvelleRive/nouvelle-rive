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

export type LedgerAccount = { id: number; number: string; label: string }

export type LedgerEntry = { id: number; label: string; date: string }

export type LedgerEntryLine = {
  id: number
  date: string
  debit: string
  credit: string
  ledger_account: { id: number; number: string } | null
  ledger_entry: { id: number }
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
  // 100 éléments par page : le grand livre d'un exercice dépasse largement 5 000
  // lignes, un plafond trop bas tronquerait silencieusement le résultat.
  for (let page = 0; page < 400; page++) {
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
export const getLedgerAccounts = () => listAll<LedgerAccount>('ledger_accounts')

const filtreDates = (debut: string, fin: string) => ({
  filter: JSON.stringify([
    { field: 'date', operator: 'gteq', value: debut },
    { field: 'date', operator: 'lteq', value: fin },
  ]),
})

export const getLedgerEntries = (debut: string, fin: string) =>
  listAll<LedgerEntry>('ledger_entries', filtreDates(debut, fin))
export const getLedgerEntryLines = (debut: string, fin: string) =>
  listAll<LedgerEntryLine>('ledger_entry_lines', filtreDates(debut, fin))

// Le relevé complet représente ~25 appels paginés : on le garde en mémoire du
// serveur quelques minutes pour qu'un aller-retour sur la page de tri ne le
// retélécharge pas. Cache par instance, perdu au redéploiement, gratuit.
let cacheTransactions: { le: number; items: Transaction[] } | null = null
const TTL_TRANSACTIONS = 5 * 60 * 1000

export async function getTransactions(forcer = false): Promise<Transaction[]> {
  if (!forcer && cacheTransactions && Date.now() - cacheTransactions.le < TTL_TRANSACTIONS) {
    return cacheTransactions.items
  }
  const items = await listAll<Transaction>('transactions')
  cacheTransactions = { le: Date.now(), items }
  return items
}

// Après une écriture, le cache ne reflète plus Pennylane.
export const viderCacheTransactions = () => { cacheTransactions = null }
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

// Réaffecte une ligne d'écriture à un autre compte. Les montants ne bougent pas,
// donc l'écriture reste équilibrée.
export async function reaffecterLigne(entryId: number, lineId: number, ledgerAccountId: number) {
  const body = JSON.stringify({ ledger_entry_lines: { update: [{ id: lineId, ledger_account_id: ledgerAccountId }] } })
  for (let essai = 0; essai < 5; essai++) {
    const res = await fetch(`${BASE}/ledger_entries/${entryId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body,
    })
    if (res.status === 429) { await pause(1200 * (essai + 1)); continue }
    if (!res.ok) throw new Error(`Pennylane PUT ledger_entries/${entryId} → ${res.status} ${await res.text()}`)
    return res.json()
  }
  throw new Error(`Pennylane PUT ledger_entries/${entryId} : limite de débit atteinte`)
}
