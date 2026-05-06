'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

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

// Élimine toutes les variantes connues de bannière Google Translate
function killGoogleBanner() {
  if (typeof document === 'undefined') return
  document
    .querySelectorAll<HTMLElement>(
      '.goog-te-banner-frame, .VIpgJd-ZVi9od-l4eHX-hSRGPd, .goog-te-spinner-pos'
    )
    .forEach((el) => el.remove())

  // Fallback : iframe en position fixed en haut de page = bannière GT
  document.querySelectorAll('iframe').forEach((f) => {
    const cs = window.getComputedStyle(f)
    const top = parseFloat(cs.top || '999')
    const h = parseFloat(cs.height || '0')
    if (cs.position === 'fixed' && top < 50 && h > 15 && h < 100) {
      f.style.setProperty('display', 'none', 'important')
    }
  })

  if (document.body.style.top && document.body.style.top !== '0px') {
    document.body.style.top = '0px'
  }
  if (document.body.style.position === 'relative') {
    document.body.style.position = 'static'
  }
  if (document.documentElement.style.marginTop) {
    document.documentElement.style.marginTop = '0px'
  }
}

const BRAND_RE = /Nouvelle Rive|NOUVELLE RIVE/g

// Enveloppe "Nouvelle Rive" / "NOUVELLE RIVE" dans des spans .notranslate
// pour que Google Translate ne traduise pas le nom de la marque
function wrapBrandName(root: Node = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const targets: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = n as Text
    const parent = t.parentElement
    if (!parent) continue
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(parent.tagName)) continue
    if (parent.closest('.notranslate')) continue
    if (!t.nodeValue) continue
    if (BRAND_RE.test(t.nodeValue)) targets.push(t)
  }
  targets.forEach((textNode) => {
    const text = textNode.nodeValue || ''
    const matches = Array.from(text.matchAll(BRAND_RE))
    if (!matches.length) return
    const frag = document.createDocumentFragment()
    let last = 0
    matches.forEach((m) => {
      const idx = m.index ?? 0
      if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)))
      const span = document.createElement('span')
      span.className = 'notranslate'
      span.setAttribute('translate', 'no')
      span.textContent = m[0]
      frag.appendChild(span)
      last = idx + m[0].length
    })
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
    try {
      textNode.parentNode?.replaceChild(frag, textNode)
    } catch {
      // React a pu retirer le node entre temps : on ignore
    }
  })
}

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const pathname = usePathname()

  // Re-wrap "Nouvelle Rive" sur chaque navigation client-side
  useEffect(() => {
    wrapBrandName()
    killGoogleBanner()
  }, [pathname])

  useEffect(() => {
    setLang(readGoogtrans())
    wrapBrandName()
    killGoogleBanner()

    const observer = new MutationObserver(() => {
      killGoogleBanner()
    })
    observer.observe(document.body, { childList: true })

    // Filet de sécurité : tape sur la bannière toutes les 200ms pendant 10s
    const intervalId = window.setInterval(killGoogleBanner, 200)
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 10000)

    if (googleScriptInjected || document.getElementById('google-translate-script')) {
      googleScriptInjected = true
      return () => {
        observer.disconnect()
        window.clearInterval(intervalId)
        window.clearTimeout(timeoutId)
      }
    }
    googleScriptInjected = true

    if (!document.getElementById('google_translate_element')) {
      const host = document.createElement('div')
      host.id = 'google_translate_element'
      host.className = 'notranslate'
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

    return () => {
      observer.disconnect()
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [])

  const choose = (target: 'fr' | 'en') => {
    if (target === lang) return
    setGoogtrans(target)
    setLang(target)
    window.location.reload()
  }

  return (
    <div
      className="notranslate flex items-center gap-1 select-none"
      translate="no"
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
        className="notranslate px-1 transition-opacity"
        translate="no"
        style={{
          color: '#000',
          opacity: lang === 'fr' ? 1 : 0.45,
          textDecoration: lang === 'fr' ? 'underline' : 'none',
        }}
      >
        FR
      </button>
      <span className="notranslate" translate="no" style={{ color: '#000', opacity: 0.45 }}>
        /
      </span>
      <button
        type="button"
        onClick={() => choose('en')}
        aria-pressed={lang === 'en'}
        className="notranslate px-1 transition-opacity"
        translate="no"
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
