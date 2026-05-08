'use client'

import { useEffect, useState } from 'react'

export type Lang = 'fr' | 'en'
const STORAGE_KEY = 'nr-lang'
const CHANGE_EVENT = 'nr-lang-change'

export function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'fr'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'en' ? 'en' : 'fr'
}

export function setStoredLang(lang: Lang) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, lang)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>('fr')

  useEffect(() => {
    setLang(getStoredLang())
    const refresh = () => setLang(getStoredLang())
    window.addEventListener('storage', refresh)
    window.addEventListener(CHANGE_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(CHANGE_EVENT, refresh)
    }
  }, [])

  return lang
}

export function t(fr: string, en: string, lang: Lang): string {
  return lang === 'en' ? en : fr
}

// Traductions FR → EN des catégories produits (macro + sous-catégories)
const CATEGORY_EN: Record<string, string> = {
  // Macro
  'prêt-à-porter': 'Ready-to-wear',
  'maroquinerie': 'Leather goods',
  'bijoux': 'Jewelry',
  'chaussures': 'Shoes',
  'accessoires': 'Accessories',
  // Vêtements
  'haut': 'Top',
  'chemise': 'Shirt',
  'pull': 'Knitwear',
  'gilet': 'Cardigan',
  'pull / gilet': 'Knitwear / Cardigan',
  'veste': 'Jacket',
  'manteau': 'Coat',
  'veste / manteau': 'Jacket / Coat',
  'robe': 'Dress',
  'pantalon': 'Trousers',
  'jupe': 'Skirt',
  'jupe / short': 'Skirt / Shorts',
  'short': 'Shorts',
  'ensemble': 'Set',
  'combinaison': 'Jumpsuit',
  // Maroquinerie
  'sac': 'Bag',
  'portefeuille': 'Wallet',
  'porte clef': 'Keyring',
  // Accessoires
  'ceinture': 'Belt',
  'chapeau': 'Hat',
  'casquette': 'Cap',
  'écharpe': 'Scarf',
  'foulard': 'Silk scarf',
  'gants': 'Gloves',
  'lunettes': 'Sunglasses',
  'vase': 'Vase',
  'porte briquet': 'Lighter holder',
  // Bijoux
  'bague': 'Ring',
  "boucles d'oreilles": 'Earrings',
  'bracelet': 'Bracelet',
  'collier': 'Necklace',
  'broche': 'Brooch',
  'broches': 'Brooches',
  'charms': 'Charms',
  'earcuff': 'Ear cuff',
  'piercing': 'Piercing',
  'bijou de cravates et foulards': 'Tie & scarf jewelry',
}

// Traduit une chaîne catégorie (gère "Veste / Manteau" → "Jacket / Coat")
export function translateCategory(fr: string, lang: Lang): string {
  if (lang !== 'en' || !fr) return fr
  const trimmed = fr.trim()
  const direct = CATEGORY_EN[trimmed.toLowerCase()]
  if (direct) {
    // Préserve la casse d'origine
    return trimmed === trimmed.toUpperCase() ? direct.toUpperCase() : direct
  }
  // Gère séparateurs ' / ' ou ' - '
  if (/\s*[\/\-–]\s*/.test(trimmed)) {
    const parts = trimmed.split(/\s*[\/\-–]\s*/).map((p) => translateCategory(p, lang))
    return parts.join(' / ')
  }
  return fr
}
