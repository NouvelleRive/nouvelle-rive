'use client'

import { useEffect, useState } from 'react'

declare global {
  interface Window {
    google?: {
      translate: {
        TranslateElement: {
          new (config: object, elementId: string): unknown
          InlineLayout: { SIMPLE: number }
        }
      }
    }
    googleTranslateElementInit?: () => void
  }
}

function readGoogtrans(): 'fr' | 'en' {
  if (typeof document === 'undefined') return 'fr'
  const m = document.cookie.match(/googtrans=\/fr\/(\w+)/)
  return m && m[1] === 'en' ? 'en' : 'fr'
}

function setGoogtrans(target: 'fr' | 'en') {
  const value = target === 'en' ? '/fr/en' : '/fr/fr'
  const host = window.location.hostname
  // Reset on all variants of the domain (Google Translate cookie quirk)
  document.cookie = `googtrans=${value};path=/`
  document.cookie = `googtrans=${value};path=/;domain=${host}`
  document.cookie = `googtrans=${value};path=/;domain=.${host}`
}

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')

  useEffect(() => {
    setLang(readGoogtrans())

    if (document.getElementById('google-translate-script')) return

    window.googleTranslateElementInit = () => {
      if (!window.google?.translate) return
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'fr',
          includedLanguages: 'en,fr',
          autoDisplay: false,
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        },
        'google_translate_element'
      )
    }

    const s = document.createElement('script')
    s.id = 'google-translate-script'
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
    s.async = true
    document.body.appendChild(s)
  }, [])

  const choose = (target: 'fr' | 'en') => {
    if (target === lang) return
    setGoogtrans(target)
    setLang(target)
    window.location.reload()
  }

  return (
    <>
      <div id="google_translate_element" style={{ display: 'none' }} />
      <div
        className="flex items-center justify-end gap-1 px-4 md:px-6 pt-2"
        style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: '10px',
          letterSpacing: '0.15em',
          fontWeight: 600,
        }}
      >
        <button
          type="button"
          onClick={() => choose('fr')}
          aria-pressed={lang === 'fr'}
          className="px-1 transition-opacity"
          style={{
            color: '#000',
            opacity: lang === 'fr' ? 1 : 0.4,
            textDecoration: lang === 'fr' ? 'underline' : 'none',
          }}
        >
          FR
        </button>
        <span style={{ opacity: 0.4 }}>/</span>
        <button
          type="button"
          onClick={() => choose('en')}
          aria-pressed={lang === 'en'}
          className="px-1 transition-opacity"
          style={{
            color: '#000',
            opacity: lang === 'en' ? 1 : 0.4,
            textDecoration: lang === 'en' ? 'underline' : 'none',
          }}
        >
          EN
        </button>
      </div>

      {/* Masque la barre Google Translate par défaut */}
      <style jsx global>{`
        .goog-te-banner-frame.skiptranslate,
        .goog-te-gadget,
        .VIpgJd-ZVi9od-l4eHX-hSRGPd { display: none !important; }
        body { top: 0 !important; position: static !important; }
        .goog-tooltip, .goog-tooltip:hover { display: none !important; }
        .goog-text-highlight {
          background-color: transparent !important;
          box-shadow: none !important;
        }
      `}</style>
    </>
  )
}
