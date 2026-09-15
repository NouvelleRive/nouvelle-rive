// Génère et résout les URLs produits hiérarchiques.
// Format : `/{type}/{marque}/{nom-slug}-{firestoreId}`
// - type : catégorie produit slugifiée (sac, robe, veste…)
// - marque : marque slugifiée, ou "sm" si pas de marque (sans-marque)
// - dernier segment : nom + id Firestore (20 chars [A-Za-z0-9]) après le dernier hyphen

type ProduitForSlug = {
  id: string
  nom?: string
  marque?: string
  color?: string
  taille?: string
  categorie?: unknown
}

export const SANS_MARQUE = 'sm'

function stripTrigramme(s: string): string {
  return s.replace(/^[A-Z]{2,10}\d{0,4}\s*[-–]\s*/i, '').trim()
}

const DIACRITICS = /[̀-ͯ]/g

function slugifyPart(s: string): string {
  return s
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getCategorieLabel(categorie: unknown): string {
  if (typeof categorie === 'string') return categorie
  if (categorie && typeof categorie === 'object' && 'label' in categorie) {
    const label = (categorie as { label?: unknown }).label
    return typeof label === 'string' ? label : ''
  }
  return ''
}

export function getTypeSlug(categorie: unknown): string {
  const label = stripTrigramme(getCategorieLabel(categorie))
  return slugifyPart(label) || 'piece'
}

export function getMarqueSlug(marque?: string): string {
  const s = slugifyPart(marque || '')
  return s || SANS_MARQUE
}

export function buildProduitPath(p: ProduitForSlug): string {
  const type = getTypeSlug(p.categorie)
  const marque = getMarqueSlug(p.marque)
  const nom = stripTrigramme(p.nom || '')
  const descParts = [p.marque, nom, p.color, p.taille]
    .map(v => (typeof v === 'string' ? v : ''))
    .filter(Boolean)
    .join(' ')
  const descSlug = slugifyPart(descParts).slice(0, 80) || 'piece'
  return `${type}/${marque}/${descSlug}-${p.id}`
}

// Alias rétro-compat — retourne désormais le chemin complet (avec slashs).
export const buildProduitSlug = buildProduitPath

// Extrait le doc id Firestore depuis le dernier segment.
// Deux formats coexistent en base : auto-ID 20 chars (ex: AbCdEfGhIjKlMnOpQrSt)
// OU SKU comme doc id (ex: PRI171, MAK22) pour ~23% des produits.
export function extractIdFromSlug(slug: string): string | null {
  const segments = slug.split('-')
  const last = segments[segments.length - 1]
  if (!last) return null
  // Firestore auto-ID : 20 chars alphanumériques (case-sensitive)
  if (/^[A-Za-z0-9]{20}$/.test(last)) return last
  // SKU-format id : 2-10 lettres + 1-5 chiffres (PRI171, MAK22, IP123…)
  if (/^[A-Za-z]{2,10}\d{1,5}$/.test(last)) return last
  // Fallback générique
  if (/^[A-Za-z0-9]{15,30}$/.test(last)) return last
  return null
}
