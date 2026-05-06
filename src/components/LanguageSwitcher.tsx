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
  document.cookie = `googtrans=${value};path=/`
  document.cookie = `googtrans=${value};path=/;domain=${host}`
  document.cookie = `googtrans=${value};path=/;domain=.${host}`
}

let googleScriptInjected = false

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')

  useEffect(() => {
    setLang(readGoogtrans())

    // Tueur de bannière Google Translate : élimine l'iframe dès qu'elle apparaît
    const killBanner = () => {
      document
        .querySelectorAll<HTMLElement>('.goog-te-banner-frame, .skiptranslate iframe')
        .forEach((el) => {
          if (el.tagName === 'IFRAME') el.remove()
        })
      if (document.body.style.top) document.body.style.top = '0px'
      if (document.body.style.position) document.body.style.position = 'static'
      document.documentElement.style.marginTop = '0px'
    }
    killBanner()
    const observer = new MutationObserver(killBanner)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })

    if (googleScriptInjected || document.getElementById('google-translate-script')) {
      googleScriptInjected = true
      return () => observer.disconnect()
    }
    googleScriptInjected = true

    if (!document.getElementById('google_translate_element')) {
      const host = document.createElement('div')
      host.id = 'google_translate_element'
      host.style.display = 'none'
      document.body.appendChild(host)
    }

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

    return () => observer.disconnect()
  }, [])

  const choose = (target: 'fr' | 'en') => {
    if (target === lang) return
    setGoogtrans(target)
    setLang(target)
    window.location.reload()
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
