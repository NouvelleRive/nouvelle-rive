'use client'

import { useEffect, useState } from 'react'
import { getStoredLang, setStoredLang, type Lang } from '@/lib/i18n'

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<Lang>('fr')

  useEffect(() => {
    setLang(getStoredLang())
    const refresh = () => setLang(getStoredLang())
    window.addEventListener('nr-lang-change', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('nr-lang-change', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const choose = (target: Lang) => {
    if (target === lang) return
    setLang(target)
    setStoredLang(target)
  }

  return (
    <div
      className="flex items-center gap-1 select-none"
      style={{
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: '9px',
        letterSpacing: '0.1em',
        fontWeight: 600,
        color: '#000',
      }}
    >
      <button
        type="button"
        onClick={() => choose('fr')}
        aria-pressed={lang === 'fr'}
        className="px-1 transition-opacity"
        style={{
          color: '#000',
          opacity: lang === 'fr' ? 1 : 0.45,
          textDecoration: lang === 'fr' ? 'underline' : 'none',
        }}
      >
        FR
      </button>
      <span style={{ color: '#000', opacity: 0.45 }}>/</span>
      <button
        type="button"
        onClick={() => choose('en')}
        aria-pressed={lang === 'en'}
        className="px-1 transition-opacity"
        style={{
          color: '#000',
          opacity: lang === 'en' ? 1 : 0.45,
          textDecoration: lang === 'en' ? 'underline' : 'none',
        }}
      >
        EN
      </button>
    </div>
  )
}
