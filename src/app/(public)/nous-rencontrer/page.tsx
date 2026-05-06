// app/nous-rencontrer/page.tsx
'use client'

import { useState, useEffect } from 'react'
import GoogleReviews from '@/components/GoogleReviews'
import { useLang, t } from '@/lib/i18n'

const bleuElectrique = '#0000FF'

const HORAIRES_FR = [
  { jour: 'Lundi', heures: '11h – 20h' },
  { jour: 'Mardi', heures: '12h – 20h' },
  { jour: 'Mercredi', heures: '12h – 20h' },
  { jour: 'Jeudi', heures: '12h – 20h' },
  { jour: 'Vendredi', heures: '11h – 20h' },
  { jour: 'Samedi', heures: '11h – 20h' },
  { jour: 'Dimanche', heures: '11h – 20h' },
]
const HORAIRES_EN = [
  { jour: 'Monday', heures: '11am – 8pm' },
  { jour: 'Tuesday', heures: '12pm – 8pm' },
  { jour: 'Wednesday', heures: '12pm – 8pm' },
  { jour: 'Thursday', heures: '12pm – 8pm' },
  { jour: 'Friday', heures: '11am – 8pm' },
  { jour: 'Saturday', heures: '11am – 8pm' },
  { jour: 'Sunday', heures: '11am – 8pm' },
]

const JOUR_INDEX_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const JOUR_INDEX_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function NousRencontrerPage() {
  const lang = useLang()
  const [displayedText, setDisplayedText] = useState('')
  const [jourActuel, setJourActuel] = useState<string | null>(null)

  useEffect(() => {
    const idx = new Date().getDay()
    setJourActuel(lang === 'en' ? JOUR_INDEX_EN[idx] : JOUR_INDEX_FR[idx])
  }, [lang])

  const introText = t(
    "PLEIN CŒUR MARAIS, QUARTIER DES ARTS, DE LA MODE, DE LA TOLÉRANCE, LA BOUTIQUE NOUVELLE RIVE SE NICHE RUE DES ECOUFFES, LA RUE DE VÊTEMENTS, ET L'ANCIENNE RUE AUX FILLES. ELLE RÉHABILITE LA PREMIÈRE BOÎTE LESBIENNE DU MARAIS, LE 3W, WOMEN WITH WOMEN. LA CABINE DE LA DJ SE TRANSFORME EN CAISSE, LE FUMOIR EN ESPACE D'EXPOSITION PREMIUM. UNE NOUVELLE VIE TOUT AUSSI RÉSOLUMENT FÉMINISTE.",
    'AT THE HEART OF LE MARAIS — DISTRICT OF ARTS, FASHION AND TOLERANCE — THE NOUVELLE RIVE BOUTIQUE NESTLES ON RUE DES ECOUFFES, THE STREET OF CLOTHING, FORMERLY KNOWN AS THE STREET OF GIRLS. IT REVIVES THE FIRST LESBIAN CLUB OF LE MARAIS, LE 3W (WOMEN WITH WOMEN). THE DJ BOOTH BECOMES THE CHECKOUT, THE SMOKING ROOM A PREMIUM EXHIBITION SPACE. A NEW LIFE — JUST AS RESOLUTELY FEMINIST.',
    lang
  )

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

        {/* 3. Tout à gauche (texte + plan + horaires + contact + itinéraire) | Vidéo à droite
            Sur mobile: ordre = texte → vidéo → plan → bouton → horaires/contact */}
        <div className="grid grid-cols-1 lg:grid-cols-2">

          {/* Texte intro (haut-gauche en desktop, 1er en mobile) */}
          <div className="order-1 lg:col-start-1 lg:row-start-1 lg:border-r border-black p-6 lg:p-12">
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
              {t('Métro Saint-Paul (ligne 1)', 'Saint-Paul metro (line 1)', lang)}
            </p>
          </div>

          {/* Vidéo (colonne droite plein hauteur en desktop, 2e en mobile, juste avant le plan) */}
          <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2 bg-black flex items-stretch min-h-[400px] border-t lg:border-t-0 border-black">
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

          {/* Plan + bouton + horaires/contact (bas-gauche en desktop, 3e en mobile) */}
          <div className="order-3 lg:col-start-1 lg:row-start-2 lg:border-r border-black flex flex-col border-t lg:border-t border-black">
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

            {/* Bouton itinéraire (juste sous le plan) */}
            <div className="px-6 lg:px-12 py-6">
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
                {t('ITINÉRAIRE', 'GET DIRECTIONS', lang)}
              </a>
            </div>

            <div className="w-full border-t border-black" />

            {/* Horaires + Contact */}
            <div className="p-6 lg:p-12">
              <div className="mb-10">
                <p
                  className="mb-4"
                  style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
                >
                  {t('HORAIRES', 'OPENING HOURS', lang)}
                </p>
                <div className="space-y-2" style={{ fontSize: '16px' }}>
                  {(lang === 'en' ? HORAIRES_EN : HORAIRES_FR).map(({ jour, heures }) => {
                    const isToday = jour === jourActuel
                    return (
                      <div
                        key={jour}
                        className="flex justify-between max-w-xs"
                        style={{ fontWeight: isToday ? 700 : 400, color: isToday ? bleuElectrique : 'inherit' }}
                      >
                        <span>{jour}{isToday && ` · ${t("aujourd'hui", 'today', lang)}`}</span>
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
            </div>
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