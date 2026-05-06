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
