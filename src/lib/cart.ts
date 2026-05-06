'use client'

import { useEffect, useState, useCallback } from 'react'

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
export const SEUIL_LIVRAISON_OFFERTE = 150
export const FRAIS_LIVRAISON = 15

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

export function calculerLivraison(sousTotal: number, modeLivraison: 'retrait' | 'livraison') {
  if (modeLivraison !== 'livraison') return 0
  return sousTotal >= SEUIL_LIVRAISON_OFFERTE ? 0 : FRAIS_LIVRAISON
}
