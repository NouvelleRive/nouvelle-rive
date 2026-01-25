// lib/admin/helpers.ts

import { collection, getDocs, query, where, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

// Vérifier que le SKU n'existe pas déjà (ou appartient au produit en cours d'édition)
export async function checkSkuUnique(sku: string, currentProduitId?: string): Promise<boolean> {
  if (!sku?.trim()) return true // SKU vide = pas de vérification
  
  const q = query(collection(db, 'produits'), where('sku', '==', sku.trim()))
  const snap = await getDocs(q)
  
  // Si aucun résultat → SKU disponible
  if (snap.empty) return true
  
  // Si on édite un produit existant, vérifier que c'est bien le même
  if (currentProduitId) {
    return snap.docs.every(doc => doc.id === currentProduitId)
  }
  
  // Sinon → doublon !
  return false
}

// =====================
// HELPERS
// =====================
export function extractSkuNumFromSkuOrName(value: string, tri: string): number | null {
  const v = value?.toString()?.trim() || ''
  const m1 = v.match(new RegExp(`^${tri}(\\d+)$`, 'i'))
  if (m1) return parseInt(m1[1], 10)
  const m2 = v.match(new RegExp(`^${tri}(\\d+)\\s*-`, 'i'))
  if (m2) return parseInt(m2[1], 10)
  return null
}

export async function computeNextSkuForTrigram(
  trigramme: string, 
  userIdentifier: string, 
  isUid: boolean = false
): Promise<string> {
  const tri = (trigramme || '').toUpperCase().trim()
  if (!tri || !userIdentifier) return ''
  try {
    const fieldName = isUid ? 'chineurUid' : 'chineur'
    const qSnap = await getDocs(
      query(collection(db, 'produits'), where(fieldName, '==', userIdentifier), where('trigramme', '==', tri))
    )
    let maxNum = 0
    qSnap.forEach((d) => {
      const data: any = d.data()
      const trySku = extractSkuNumFromSkuOrName(data?.sku || '', tri)
      const tryName = extractSkuNumFromSkuOrName(data?.nom || '', tri)
      const n = Math.max(trySku ?? 0, tryName ?? 0)
      if (n > maxNum) maxNum = n
    })
    return `${tri}${maxNum + 1}`
  } catch {
    return ''
  }
}

export function readCategorieRapportLabel(data: any): string {
  const variants = data?.['Catégorie de rapport'] ?? data?.['catégorie de rapport'] ?? data?.categorieRapport ?? data?.categorie_de_rapport ?? data?.categorie_rapport ?? []
  let label = ''
  if (Array.isArray(variants) && variants.length > 0 && typeof variants[0] === 'object') {
    const v0 = variants[0]
    label = (v0?.label ?? v0?.nom ?? '').toString().trim()
  }
  if (!label && typeof data?.categorieRapportLabel === 'string') label = data.categorieRapportLabel.trim()
  return label
}

export async function uploadToBunny(file: File): Promise<string> {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const filename = `produit_${timestamp}_${random}.png`
  const path = `produits/${filename}`

  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.slice(i, i + chunkSize))
  }
  const base64 = btoa(binary)

  const response = await fetch('/api/upload-bunny', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, path, contentType: file.type || 'image/png' })
  })

  if (!response.ok) throw new Error('Erreur upload Bunny')
  const data = await response.json()
  return data.url
}

export function canUseFashnAI(categorie: string): boolean {
  const cat = (categorie || '').toLowerCase()
  if (
    cat.includes('bague') || cat.includes('boucle') || cat.includes('collier') || 
    cat.includes('bracelet') || cat.includes('broche') || cat.includes('chaussure') || 
    cat.includes('basket') || cat.includes('botte') || cat.includes('bottine') || 
    cat.includes('sandale') || cat.includes('escarpin') || cat.includes('mocassin') || 
    cat.includes('derby') || cat.includes('loafer') || cat.includes('sneaker') || 
    cat.includes('talon') || cat.includes('ceinture') || cat.includes('sac') || 
    cat.includes('foulard') || cat.includes('écharpe') || cat.includes('lunettes') || 
    cat.includes('chapeau') || cat.includes('bonnet') || cat.includes('gant') || 
    cat.includes('montre')
  ) {
    return false
  }
  return true
}

// Marques de luxe (priorité eBay US)
export const LUXURY_BRANDS = [
  'hermès', 'hermes', 'chanel', 'louis vuitton', 'lv', 'dior', 'christian dior',
  'céline', 'celine', 'yves saint laurent', 'ysl', 'saint laurent', 'gucci',
  'burberry', 'givenchy', 'lanvin', 'nina ricci', 'balenciaga', 'bottega veneta',
  'prada', 'fendi', 'valentino', 'loewe', 'cartier', 'van cleef', 'boucheron',
]

export function getBrandPriority(marque?: string): number {
  if (!marque) return 999
  const m = marque.toLowerCase().trim()
  const index = LUXURY_BRANDS.findIndex(b => m.includes(b) || b.includes(m))
  return index === -1 ? 999 : index
}