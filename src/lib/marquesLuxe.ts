// Définition unique des marques LUXE (sans dépendance : utilisable client ET serveur).
// lib/admin/helpers.ts la ré-exporte (LUXURY_BRANDS, getBrandPriority).

export const LUXURY_BRANDS = [
  'hermès', 'hermes', 'chanel', 'louis vuitton', 'lv', 'dior', 'christian dior',
  'céline', 'celine', 'yves saint laurent', 'ysl', 'saint laurent', 'gucci',
  'burberry', 'givenchy', 'lanvin', 'nina ricci', 'balenciaga', 'bottega veneta',
  'prada', 'fendi', 'valentino', 'loewe', 'cartier', 'van cleef', 'boucheron',
]

// Match strict par mots entiers : « Burberrys » ou « Christian Dior » passent,
// mais pas « Lee » (dans « van cleef ») ni « Quiksilver » (contient « lv »).
export function isMarqueLuxe(marque?: string | null): boolean {
  const m = (marque || '').toLowerCase().trim()
  if (!m) return false
  const mots = m.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean)
  const s = ` ${mots.join(' ')} `
  return LUXURY_BRANDS.some(b => {
    const bb = b.normalize('NFD').replace(/[̀-ͯ]/g, '')
    return s.includes(` ${bb} `) || s.includes(` ${bb}s `)
  })
}

// Seuil prix : au-delà, une pièce sans grande marque compte comme luxe pour eBay
// (ex. fourrures, cuirs, pièces de créateur).
export const PRIX_LUXE_MIN = 450

// Pièce « luxe » pour eBay = marque luxe OU prix ≥ 450 €.
export function isPieceLuxe(p: { marque?: string | null; prix?: number | null }): boolean {
  return isMarqueLuxe(p.marque) || (Number(p.prix) || 0) >= PRIX_LUXE_MIN
}
