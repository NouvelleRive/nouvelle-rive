'use client'

import { useEffect, useState } from 'react'
import { getConsent, setConsent, pixelConfigured } from '@/lib/consent'
import { initPixel, pixelPageView } from '@/lib/metaPixel'
import { useLang, t } from '@/lib/i18n'

const bleuElectrique = '#0000FF'

// Bannière de consentement cookies publicitaires (RGPD/CNIL).
// N'apparaît que si un Pixel est configuré ET qu'aucun choix n'a encore été fait.
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)
  const lang = useLang()

  useEffect(() => {
    if (!pixelConfigured()) return
    const c = getConsent()
    if (c === 'granted') {
      initPixel()
      pixelPageView()
    } else if (!c) {
      setVisible(true)
    }
  }, [])

  const decide = (v: 'granted' | 'denied') => {
    setConsent(v)
    setVisible(false)
    if (v === 'granted') {
      initPixel()
      pixelPageView()
    }
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label={t('Consentement cookies', 'Cookie consent', lang)}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#fff',
        borderTop: '2px solid #000',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
        padding: 'clamp(20px, 3vw, 36px) clamp(20px, 5vw, 64px)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'clamp(16px, 3vw, 40px)',
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <p
          style={{
            fontSize: '11px',
            letterSpacing: '0.2em',
            fontWeight: 700,
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
          }}
        >
          {t('Cookies', 'Cookies', lang)}
        </p>
        <p style={{ fontSize: 'clamp(14px, 1.5vw, 17px)', lineHeight: 1.6, color: '#1a1a1a', margin: 0 }}>
          {t(
            'On utilise des cookies de mesure (Meta) pour comprendre ce qui vous plaît et améliorer la boutique. Vous êtes libre d’accepter ou de refuser — ça ne change rien à votre navigation.',
            'We use analytics cookies (Meta) to understand what you love and improve the shop. You’re free to accept or decline — it won’t change your browsing.',
            lang
          )}{' '}
          <a href="/legal/confidentialite" style={{ textDecoration: 'underline', color: '#1a1a1a', whiteSpace: 'nowrap' }}>
            {t('En savoir plus', 'Learn more', lang)}
          </a>
        </p>
      </div>
      <div style={{ display: 'flex', gap: '14px', flexShrink: 0 }}>
        <button
          onClick={() => decide('denied')}
          style={{
            padding: 'clamp(12px, 1.4vw, 18px) clamp(24px, 3vw, 40px)',
            fontSize: 'clamp(12px, 1.1vw, 14px)',
            letterSpacing: '0.15em',
            fontWeight: 600,
            border: '1px solid #000',
            background: 'transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t('REFUSER', 'DECLINE', lang)}
        </button>
        <button
          onClick={() => decide('granted')}
          style={{
            padding: 'clamp(12px, 1.4vw, 18px) clamp(24px, 3vw, 40px)',
            fontSize: 'clamp(12px, 1.1vw, 14px)',
            letterSpacing: '0.15em',
            fontWeight: 600,
            border: `1px solid ${bleuElectrique}`,
            background: bleuElectrique,
            color: '#fff',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t('ACCEPTER', 'ACCEPT', lang)}
        </button>
      </div>
    </div>
  )
}
