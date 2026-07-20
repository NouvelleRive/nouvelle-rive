'use client'

import { useEffect, useState, useCallback } from 'react'
import { trackAddToCart } from './backstage'

export type CartItem = {
  id: string
  nom: string
  prix: number
  imageUrl: string | null
  marque?: string | null
  sku?: string | null
}

const STORAGE_KEY = 'nouvelle-rive-cart'
const EVENT = 'nouvelle-rive-cart-update'

// Re-export depuis lib/shipping pour les anciens consommateurs
export {
  SEUIL_LIVRAISON_OFFERTE,
  FRAIS_LIVRAISON_FR,
  FRAIS_LIVRAISON_EU,
  FRAIS_LIVRAISON_INTL,
  PAYS_LIVRAISON,
  getZonePays,
  getFraisLivraison,
} from './shipping'

import { getFraisLivraison as _getFrais, FRAIS_LIVRAISON_FR as _FR } from './shipping'

// Compat : ancien export utilisé par d'autres fichiers
export const FRAIS_LIVRAISON = _FR

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setItems(readCart())
    setHydrated(true)
    const refresh = () => setItems(readCart())
    window.addEventListener(EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const addItem = useCallback((item: CartItem) => {
    const current = readCart()
    if (current.some(i => i.id === item.id)) return false
    writeCart([...current, item])
    trackAddToCart()
    return true
  }, [])

  const removeItem = useCallback((id: string) => {
    writeCart(readCart().filter(i => i.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    writeCart([])
  }, [])

  const hasItem = useCallback((id: string) => {
    return items.some(i => i.id === id)
  }, [items])

  const sousTotal = items.reduce((s, i) => s + (i.prix || 0), 0)

  return {
    items,
    hydrated,
    count: items.length,
    sousTotal,
    addItem,
    removeItem,
    clearCart,
    hasItem,
  }
}

export function calculerLivraison(
  sousTotal: number,
  modeLivraison: 'retrait' | 'livraison',
  codePays: string = 'FR'
) {
  if (modeLivraison !== 'livraison') return 0
  return _getFrais(codePays, sousTotal)
}
