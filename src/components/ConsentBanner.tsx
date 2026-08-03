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
        borderTop: '1px solid #000',
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <p style={{ fontSize: '12px', lineHeight: 1.6, color: '#333', maxWidth: '640px', margin: 0 }}>
        {t(
          'Nous utilisons des cookies de mesure d’audience publicitaire (Meta) pour améliorer nos campagnes. Vous pouvez accepter ou refuser.',
          'We use advertising analytics cookies (Meta) to improve our campaigns. You can accept or decline.',
          lang
        )}{' '}
        <a href="/legal/confidentialite" style={{ textDecoration: 'underline', color: '#333' }}>
          {t('En savoir plus', 'Learn more', lang)}
        </a>
      </p>
      <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={() => decide('denied')}
          style={{
            padding: '10px 18px',
            fontSize: '11px',
            letterSpacing: '0.15em',
            fontWeight: 600,
            border: '1px solid #000',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          {t('REFUSER', 'DECLINE', lang)}
        </button>
        <button
          onClick={() => decide('granted')}
          style={{
            padding: '10px 18px',
            fontSize: '11px',
            letterSpacing: '0.15em',
            fontWeight: 600,
            border: `1px solid ${bleuElectrique}`,
            background: bleuElectrique,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {t('ACCEPTER', 'ACCEPT', lang)}
        </button>
      </div>
    </div>
  )
}
