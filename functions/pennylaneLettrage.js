// Lettrage automatique des factures chineuses dans Pennylane.
//
// Le circuit amont marche déjà tout seul : la chineuse envoie sa facture
// Factur-X à nouvelleriveparis@, une règle Gmail la transfère à l'adresse de
// dépôt Pennylane, Pennylane crée la facture fournisseur avec les bons
// montants. Ce qui manquait, c'est le rapprochement avec le virement.
//
// La référence NRmmaa-TRI figure des deux côtés — numéro de facture et libellé
// du virement Shine — donc on rapproche là-dessus, pas sur le montant : les
// factures sont souvent générées avant que toutes les ventes du mois soient
// saisies, et c'est le virement qui fait foi.
//
// Appelé en fin de checkGmailFactures (cron quotidien existant), donc aucun
// nouveau Cloud Scheduler.

const BASE = 'https://app.pennylane.com/api/external/v2'

async function appel(chemin, options = {}) {
  const fetch = require('node-fetch')
  for (let essai = 0; essai < 4; essai++) {
    const res = await fetch(BASE + chemin, {
      ...options,
      headers: {
        Authorization: `Bearer ${process.env.PENNYLANE_API_TOKEN}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
    if (res.status !== 429) return res
    await new Promise((r) => setTimeout(r, 1000 * (essai + 1)))
  }
  return null
}

async function toutesLesPages(chemin) {
  let items = []
  let cursor = null
  for (let page = 0; page < 400; page++) {
    const sep = chemin.includes('?') ? '&' : '?'
    const suffixe = `${sep}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const res = await appel(chemin + suffixe)
    if (!res || !res.ok) break
    const json = await res.json()
    items = items.concat(json.items || [])
    if (!json.has_more) break
    cursor = json.next_cursor
    await new Promise((r) => setTimeout(r, 150))
  }
  return items
}

const reference = (texte) =>
  (texte || '').toUpperCase().match(/NR\d{4}-[A-Z0-9]+/)?.[0] || null

async function lettrerFacturesChineuses() {
  if (!process.env.PENNYLANE_API_TOKEN) {
    console.log('⏭️  PENNYLANE_API_TOKEN absent, lettrage ignoré')
    return
  }

  const factures = (await toutesLesPages('/supplier_invoices')).filter((f) =>
    reference(f.invoice_number)
  )
  const transactions = await toutesLesPages('/transactions')

  const parReference = new Map()
  for (const t of transactions) {
    const ref = reference(t.label)
    if (!ref) continue
    if (!parReference.has(ref)) parReference.set(ref, [])
    parReference.get(ref).push(t)
  }

  let rapprochees = 0
  let echecs = 0
  for (const facture of factures) {
    const ref = reference(facture.invoice_number)
    const candidats = parReference.get(ref) || []
    // Une seule transaction porte la référence, sinon on laisse à la main.
    if (candidats.length !== 1) continue

    const dejaRes = await appel(`/supplier_invoices/${facture.id}/matched_transactions`)
    if (!dejaRes || !dejaRes.ok) continue
    const deja = await dejaRes.json()
    if ((deja.items || []).length) continue

    const res = await appel(`/supplier_invoices/${facture.id}/matched_transactions`, {
      method: 'POST',
      body: JSON.stringify({ transaction_id: candidats[0].id }),
    })
    if (res && res.ok) {
      rapprochees++
      console.log(`🔗 ${ref} rapprochée`)
    } else {
      echecs++
      console.log(`❌ ${ref} : ${res ? res.status : 'pas de réponse'}`)
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  console.log(`✅ lettrage Pennylane : ${rapprochees} rapprochées, ${echecs} échecs`)
}

module.exports = { lettrerFacturesChineuses }
