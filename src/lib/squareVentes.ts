// Ventes nettes Square sur une période, lues directement chez Square.
//
// Pourquoi pas la compta : le compte de transit 511301 porte les *virements*
// Square, pas les ventes. Square verse à J+1 ou J+2, donc la fin d'un mois
// tombe sur le suivant et la fin d'un exercice sur l'exercice d'après. Sur
// 2025 l'écart atteint 30 000 €.
//
// Ventes nettes = total des commandes encaissées moins les remboursements,
// la même définition que le tableau de bord Square.

const BASE = process.env.SQUARE_ENV === 'sandbox'
  ? 'https://connect.squareupsandbox.com'
  : 'https://connect.squareup.com'

export type VentesSquare = {
  total: number
  commandes: number
  parMois: Record<string, { net: number; commandes: number }>
  // Une entrée par article vendu : le nom porte le SKU, donc la chineuse.
  lignes: { mois: string; nom: string; montant: number }[]
}

export async function ventesSquare(start: string, end: string): Promise<VentesSquare | null> {
  const token = process.env.SQUARE_ACCESS_TOKEN
  const location = process.env.SQUARE_LOCATION_ID
  if (!token || !location) return null

  const parMois: Record<string, { net: number; commandes: number }> = {}
  const lignes: VentesSquare['lignes'] = []
  let total = 0
  let commandes = 0
  let cursor: string | undefined

  // Pagination Square : 500 commandes par page, 40 pages au plus par sécurité.
  for (let page = 0; page < 40; page++) {
    const res = await fetch(`${BASE}/v2/orders/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Square-Version': '2024-10-17',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location_ids: [location],
        limit: 500,
        cursor,
        query: {
          filter: {
            date_time_filter: {
              closed_at: { start_at: `${start}T00:00:00Z`, end_at: `${end}T23:59:59Z` },
            },
            state_filter: { states: ['COMPLETED'] },
          },
        },
      }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()

    for (const o of json.orders || []) {
      const brut = Number(o.total_money?.amount || 0)
      const remb = Number(o.return_amounts?.total_money?.amount || 0)
      const net = (brut - remb) / 100
      const cle = String(o.closed_at || o.created_at || '').slice(0, 7)
      if (!parMois[cle]) parMois[cle] = { net: 0, commandes: 0 }
      parMois[cle].net += net
      parMois[cle].commandes += 1
      total += net
      commandes += 1

      for (const li of o.line_items || []) {
        const m = Number(li.total_money?.amount || 0) / 100
        if (m) lignes.push({ mois: cle, nom: String(li.name || ''), montant: m })
      }
    }

    cursor = json.cursor
    if (!cursor) break
  }

  return { total, commandes, parMois, lignes }
}
