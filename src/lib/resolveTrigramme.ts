import type { Firestore } from 'firebase-admin/firestore'

// Cache module-scope : évite de re-lire la collection à chaque webhook
let cachedTrigrammes: string[] | null = null
let cachedAt = 0
const TTL_MS = 5 * 60 * 1000

async function getChineuseTrigrammes(db: Firestore): Promise<string[]> {
  if (cachedTrigrammes && Date.now() - cachedAt < TTL_MS) return cachedTrigrammes
  const snap = await db.collection('chineuse').get()
  cachedTrigrammes = snap.docs
    .map(d => (d.data().trigramme || '').toString().trim().toUpperCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length) // longest-match first (MAK avant MA)
  cachedAt = Date.now()
  return cachedTrigrammes
}

// Résout le trigramme canonique d'une chineuse à partir d'un SKU.
// Indispensable pour les SKUs spéciaux comme MAKCHA001 (lunettes Chanel Maki)
// qui doivent retomber sur "MAK" et non "MAKCHA".
export async function resolveTrigrammeFromSku(
  db: Firestore,
  sku: string | null | undefined,
): Promise<string | null> {
  if (!sku) return null
  const prefix = sku.toString().match(/^[A-Za-z]+/)?.[0]?.toUpperCase()
  if (!prefix) return null
  const triList = await getChineuseTrigrammes(db)
  return triList.find(t => prefix.startsWith(t)) || null
}
