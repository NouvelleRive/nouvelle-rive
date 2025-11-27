// src/components/CountdownPromo.tsx
'use client'

import { useEffect, useState } from 'react'

type CountdownPromoProps = {
  nombreAchats: number
}

export default function CountdownPromo({ nombreAchats }: CountdownPromoProps) {
  const [tempsRestant, setTempsRestant] = useState<string>('')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (nombreAchats < 1) {
      setIsVisible(false)
      return
    }

    const calculerFinPromo = () => {
      const now = new Date()
      const finPromo = new Date()
      finPromo.setHours(16, 0, 0, 0)
      if (now.getHours() >= 16) {
        finPromo.setDate(finPromo.getDate() + 1)
      }
      return finPromo
    }

    const finPromo = calculerFinPromo()

    const updateCountdown = () => {
      const now = new Date()
      const diff = finPromo.getTime() - now.getTime()

      if (diff <= 0) {
        setTempsRestant('00:00:00')
        setIsVisible(false)
        return
      }

      const heures = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const secondes = Math.floor((diff % (1000 * 60)) / 1000)

      setTempsRestant(
        `${heures.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secondes.toString().padStart(2, '0')}`
      )
      setIsVisible(true)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [nombreAchats])

  if (!isVisible || nombreAchats < 1) return null

  const getMessage = () => {
    if (nombreAchats === 1) {
      return 'LIVRAISON OFFERTE DÈS 2 ARTICLES • -15% SUR LE 3E'
    }
    return '-15% SUR LE 3E ARTICLE'
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-slideUp">
      <div 
        className="px-3 py-2 rounded shadow-lg text-white flex items-center gap-3"
        style={{ 
          backgroundColor: '#22209C',
          fontFamily: 'Helvetica, Arial, sans-serif'
        }}
      >
        <span style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
          🎁 {getMessage()}
        </span>
        <span 
          className="font-bold"
          style={{ fontSize: '11px', fontFamily: 'monospace' }}
        >
          ⏱ {tempsRestant}
        </span>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}