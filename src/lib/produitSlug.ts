// Génère et résout les slugs descriptifs pour les URLs produits.
// Format : `{type}-{marque}-{nom}-{couleur}-{taille}-{firestoreId}`
// Le firestoreId (20 chars, [A-Za-z0-9]) est toujours en dernier segment → extraction par split('-').pop().

type ProduitForSlug = {
  id: string
  nom?: string
  marque?: string
  color?: string
  taille?: string
  categorie?: unknown
}

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

export function buildProduitSlug(p: ProduitForSlug): string {
  const type = stripTrigramme(getCategorieLabel(p.categorie))
  const nom = stripTrigramme(p.nom || '')
  const parts = [type, p.marque, nom, p.color, p.taille]
    .map(v => (typeof v === 'string' ? v : ''))
    .filter(Boolean)
    .join(' ')
  const base = slugifyPart(parts).slice(0, 80) || 'piece'
  return `${base}-${p.id}`
}

// Extrait le doc id Firestore depuis un slug (toujours dernier segment hyphen).
// Les IDs Firestore auto sont 20 chars dans [A-Za-z0-9], donc pas d'ambiguïté avec le reste du slug.
export function extractIdFromSlug(slug: string): string | null {
  const segments = slug.split('-')
  const last = segments[segments.length - 1]
  if (!last) return null
  if (/^[A-Za-z0-9]{20}$/.test(last)) return last
  if (/^[A-Za-z0-9]{15,30}$/.test(last)) return last
  return null
}
