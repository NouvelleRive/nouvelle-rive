// Codes promo ciblés sur des pièces précises (ex. LOAH15 : -15 % sur 5 SKU),
// sans limite d'utilisation ni date de fin. Désactivables avec `actif: false`.
//
// Remise financée par NOUVELLE RIVE : la vente de la chineuse reste au prix plein
// (le webhook Square enregistre produit.prix, pas le montant remisé).
//
// Zéro-facture : doc id = code → une lecture par ID, jamais de scan.
import { adminDb } from '@/lib/firebaseAdmin'

export type CodePromo = { code: string; remisePct: number; skus: string[] }

export async function lireCodePromo(code: string): Promise<CodePromo | null> {
  const c = (code || '').trim().toUpperCase()
  if (!c || c.includes('/')) return null
  const snap = await adminDb.collection('codesPromoArticles').doc(c).get()
  const d = snap.data()
  if (!d || d.actif === false) return null
  return {
    code: c,
    remisePct: Number(d.remisePct) || 0,
    skus: (d.skus || []).map((s: string) => String(s).toUpperCase()),
  }
}
