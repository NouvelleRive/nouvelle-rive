// src/components/PopupPromotion.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang, t } from '@/lib/i18n'

type PopupPromotionProps = {
  nombreAchats: number
}

export default function PopupPromotion({ nombreAchats }: PopupPromotionProps) {
  const lang = useLang()
  const [isOpen, setIsOpen] = useState(false)
  const [hasShown, setHasShown] = useState(false)

  useEffect(() => {
    const popupShown = sessionStorage.getItem(`popup-shown-${nombreAchats}`)

    if (!popupShown && !hasShown && nombreAchats > 0) {
      const timer = setTimeout(() => {
        setIsOpen(true)
        setHasShown(true)
        sessionStorage.setItem(`popup-shown-${nombreAchats}`, 'true')
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [nombreAchats, hasShown])

  const handleClose = () => {
    setIsOpen(false)
  }

  if (!isOpen) return null

  let titre = ''
  let message = ''

  if (nombreAchats === 1) {
    titre = t('LIVRAISON OFFERTE', 'FREE SHIPPING', lang)
    message = t('SUR VOTRE PROCHAIN ARTICLE', 'ON YOUR NEXT ITEM', lang)
  } else if (nombreAchats === 2) {
    titre = '-15%'
    message = t('SUR VOTRE 3ÈME ARTICLE', 'ON YOUR 3RD ITEM', lang)
  } else {
    titre = t('MERCI', 'THANK YOU', lang)
    message = t('VOS ENVOIS SERONT REGROUPÉS', 'YOUR ITEMS WILL BE SHIPPED TOGETHER', lang)
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-lg relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-0 right-0 w-12 h-12 flex items-center justify-center text-black hover:bg-black hover:text-white transition-colors"
          style={{
            fontSize: '24px',
            fontWeight: '300'
          }}
        >
          ✕
        </button>

        <div className="p-12 pt-16 text-center">
          <h2
            style={{
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize: 'clamp(48px, 10vw, 72px)',
              fontWeight: '700',
              letterSpacing: '-0.03em',
              lineHeight: '0.9',
              color: '#000'
            }}
          >
            {titre}
          </h2>

          <p
            className="mt-4 mb-8"
            style={{
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: '#000'
            }}
          >
            {message}
          </p>

          <div className="space-y-3">
            <Link
              href="/boutique"
              onClick={handleClose}
              className="block w-full py-4 bg-black text-white text-center transition-colors hover:bg-white hover:text-black border border-black"
              style={{
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: '11px',
                letterSpacing: '0.2em',
                fontWeight: '600'
              }}
            >
              {t('CONTINUER MES ACHATS', 'CONTINUE SHOPPING', lang)}
            </Link>

            <button
              onClick={handleClose}
              className="block w-full py-4 bg-white text-black text-center transition-colors hover:bg-black hover:text-white border border-black"
              style={{
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: '11px',
                letterSpacing: '0.2em',
                fontWeight: '600'
              }}
            >
              {t('FERMER', 'CLOSE', lang)}
            </button>
          </div>
        </div>

        <div className="h-1 bg-black" />
      </div>
    </div>
  )
}
