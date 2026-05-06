// app/nous-rencontrer/page.tsx
'use client'

import { useState, useEffect } from 'react'
import GoogleReviews from '@/components/GoogleReviews'

const bleuElectrique = '#0000FF'

const HORAIRES = [
  { jour: 'Lundi', heures: '11h – 20h' },
  { jour: 'Mardi', heures: '12h – 20h' },
  { jour: 'Mercredi', heures: '12h – 20h' },
  { jour: 'Jeudi', heures: '12h – 20h' },
  { jour: 'Vendredi', heures: '11h – 20h' },
  { jour: 'Samedi', heures: '11h – 20h' },
  { jour: 'Dimanche', heures: '11h – 20h' },
]

// JS getDay: 0=dimanche, 1=lundi, …, 6=samedi
const JOUR_INDEX_TO_NAME = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export default function NousRencontrerPage() {
  const [displayedText, setDisplayedText] = useState('')
  const [jourActuel, setJourActuel] = useState<string | null>(null)

  useEffect(() => {
    setJourActuel(JOUR_INDEX_TO_NAME[new Date().getDay()])
  }, [])
  
  const introText = "PLEIN CŒUR MARAIS, QUARTIER DES ARTS, DE LA MODE, DE LA TOLÉRANCE, LA BOUTIQUE NOUVELLE RIVE SE NICHE RUE DES ECOUFFES, LA RUE DE VÊTEMENTS, ET L'ANCIENNE RUE AUX FILLES. ELLE RÉHABILITE LA PREMIÈRE BOÎTE LESBIENNE DU MARAIS, LE 3W, WOMEN WITH WOMEN. LA CABINE DE LA DJ SE TRANSFORME EN CAISSE, LE FUMOIR EN ESPACE D'EXPOSITION PREMIUM. UNE NOUVELLE VIE TOUT AUSSI RÉSOLUMENT FÉMINISTE."

  // Typewriter effect
  useEffect(() => {
    setDisplayedText('')
    let currentIndex = 0
    
    const interval = setInterval(() => {
      if (currentIndex <= introText.length) {
        setDisplayedText(introText.slice(0, currentIndex))
        currentIndex++
      } else {
        clearInterval(interval)
      }
    }, 30)

    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      
      <main className="min-h-screen bg-white">

        {/* Hero */}
        <div className="px-6 py-20">
          <h1
            style={{
              fontSize: 'clamp(40px, 8vw, 120px)',
              fontWeight: '700',
              letterSpacing: '-0.03em',
              lineHeight: '0.9',
              textTransform: 'uppercase'
            }}
          >
            8 RUE DES<br />ECOUFFES
          </h1>
        </div>

        {/* Trait */}
        <div className="w-full border-t border-black" />

        {/* 1. Photo façade plein écran (ratio naturel pour ne pas couper le nom) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/facade%20paysage.jpg"
          alt="Devanture Nouvelle Rive, 8 rue des Écouffes, Paris"
          className="w-full block"
          style={{ height: 'auto', display: 'block' }}
        />

        {/* Trait */}
        <div className="w-full border-t border-black" />

        {/* 2. Avis Google */}
        <GoogleReviews />

        {/* Trait */}
        <div className="w-full border-t border-black" />

        {/* 3. Tout à gauche (texte + plan + horaires + contact + itinéraire) | Vidéo à droite */}
        <div className="grid grid-cols-1 lg:grid-cols-2">

          {/* Colonne gauche */}
          <div className="lg:border-r border-black flex flex-col">
            {/* Texte intro */}
            <div className="p-6 lg:p-12">
              <p
                className="uppercase font-semibold"
                style={{
                  fontSize: 'clamp(11px, 1.2vw, 13px)',
                  letterSpacing: '0.04em',
                  lineHeight: '1.8',
                  color: bleuElectrique,
                  minHeight: '150px',
                }}
              >
                {displayedText}
                {displayedText.length < introText.length && (
                  <span className="animate-pulse">|</span>
                )}
              </p>
              <p className="mt-6" style={{ fontSize: '18px', fontWeight: '500', lineHeight: '1.3' }}>
                Le Marais, 75004 Paris
              </p>
              <p className="mt-2" style={{ fontSize: '14px', color: '#666' }}>
                Métro Saint-Paul (ligne 1)
              </p>
            </div>

            <div className="w-full border-t border-black" />

            {/* Plan */}
            <div className="h-[350px]">
              <iframe
                src="https://maps.google.com/maps?q=Nouvelle+Rive,+8+rue+des+%C3%89couffes,+75004+Paris&z=17&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'grayscale(100%)' }}
                allowFullScreen
                loading="lazy"
                title="Plan Nouvelle Rive"
              />
            </div>

            <div className="w-full border-t border-black" />

            {/* Horaires + Contact + Itinéraire */}
            <div className="p-6 lg:p-12">
              <div className="mb-10">
                <p
                  className="mb-4"
                  style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
                >
                  HORAIRES
                </p>
                <div className="space-y-2" style={{ fontSize: '16px' }}>
                  {HORAIRES.map(({ jour, heures }) => {
                    const isToday = jour === jourActuel
                    return (
                      <div
                        key={jour}
                        className="flex justify-between max-w-xs"
                        style={{ fontWeight: isToday ? 700 : 400, color: isToday ? bleuElectrique : 'inherit' }}
                      >
                        <span>{jour}{isToday && ' · aujourd\'hui'}</span>
                        <span style={{ fontWeight: isToday ? 700 : 500 }}>{heures}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="w-full border-t border-black mb-10" />

              <div className="mb-10">
                <p
                  className="mb-4"
                  style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
                >
                  CONTACT
                </p>
                <div className="flex flex-col gap-2 mt-2">
                  <a
                    href="https://www.instagram.com/nouvellerive"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 hover:opacity-60 transition-opacity"
                    style={{ fontSize: '16px', color: bleuElectrique }}
                  >
                    <span style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#000', fontWeight: 600, minWidth: 70 }}>INSTAGRAM</span>
                    @nouvelleriveparis
                  </a>
                  <a
                    href="https://www.tiktok.com/@nouvelle.rive"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 hover:opacity-60 transition-opacity"
                    style={{ fontSize: '16px', color: bleuElectrique }}
                  >
                    <span style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#000', fontWeight: 600, minWidth: 70 }}>TIKTOK</span>
                    @nouvelle.rive
                  </a>
                </div>
              </div>

              <a
                href="https://www.google.com/maps/place/NOUVELLE+RIVE/@48.8565713,2.3585257,17z/data=!4m6!3m5!1s0x47e66f1afea642dd:0xbaab4baf5127a88e!8m2!3d48.8565713!4d2.3585257!16s%2Fg%2F11x8cxw8q0"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block py-4 px-8 text-white transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: bleuElectrique,
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  fontWeight: '600'
                }}
              >
                ITINÉRAIRE
              </a>
            </div>
          </div>

          {/* Colonne droite : vidéo plein hauteur */}
          <div className="bg-black flex items-stretch min-h-[400px]">
            <video
              src="/Entr%C3%A9e.mov"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full"
              style={{ objectFit: 'cover', height: '100%', filter: 'saturate(1.25) contrast(1.03)' }}
            />
          </div>
        </div>

        {/* Trait */}
        <div className="w-full border-t border-black" />

      </main>

      {/* Footer */}
      <footer className="border-t border-black py-8 text-center">
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#999' }}>
          NOUVELLE RIVE — 8 RUE DES ECOUFFES, PARIS
        </p>
      </footer>
    </div>
  )
}