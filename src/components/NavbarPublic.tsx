// src/components/NavbarPublic.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import { useCart } from '@/lib/cart'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function NavbarPublic() {
  const pathname = usePathname()
  const [compteHref, setCompteHref] = useState('/client/login')
  const { count, hydrated } = useCart()
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = pathname === '/boutique'

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.25
  }, [showVideo])

  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleuElectrique = '#0000FF'
  const bleuNR = '#22209C'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCompteHref(user ? '/client' : '/client/login')
    })
    return () => unsubscribe()
  }, [])

  // Contenu de navigation
  const boutiqueLinks = [
    { href: '/boutique', label: 'NEW IN' },
    { href: '/nous-rencontrer', label: 'IRL : NOTRE BOUTIQUE 8 RUE DES ECOUFFES' },
    { href: '/ete', label: 'ÉTÉ' },
    { href: '/soiree', label: 'SOIRÉE' },
    { href: '/les-iconiques', label: 'LES ICONIQUES DU VINTAGE' },
    { href: '/luxe', label: 'LE LUXE' },
    { href: '/coups-de-coeur', label: 'NOS PIÈCES PRÉFÉRÉES' },
    { href: '/nos-creatrices', label: 'NOS CRÉATRICES/CURATEURICES' },
    { href: '/femme', label: '(PLUTÔT) FEMME' },
    { href: '/homme', label: '(PLUTÔT) HOMME' },
    { href: '/enfant', label: 'ENFANT' },
    { href: '/accessoires', label: 'ACCESSOIRES' },
    { href: '/ateliers', label: 'ATELIER BIJOU UPCYCLÉ AVEC UNE DESIGNEUSE' },
  ]


  return (
    <>
      {/* Vidéo bannière (boutique uniquement) */}
      {showVideo && (
        <div className="relative w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            src="/banner.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="w-full h-auto md:h-screen md:object-cover block"
          />
          {/* Boutons Panier + Mon Compte en overlay */}
          <div
            className="absolute top-4 right-4 md:top-6 md:right-6 flex items-center gap-3 z-10"
            style={{ fontFamily: fontHelvetica }}
          >
            <LanguageSwitcher variant="dark" />
            <Link
              href="/panier"
              className="relative px-3 md:px-4 py-2 border border-white text-white bg-black/30 backdrop-blur-sm hover:bg-white hover:text-black transition-all duration-200"
              style={{
                fontSize: '9px',
                letterSpacing: '0.1em',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}
            >
              PANIER {hydrated && count > 0 ? `(${count})` : ''}
            </Link>
            <Link
              href={compteHref}
              className="px-3 md:px-4 py-2 border border-white text-white bg-black/30 backdrop-blur-sm hover:bg-white hover:text-black transition-all duration-200"
              style={{
                fontSize: '9px',
                letterSpacing: '0.1em',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}
            >
              MON COMPTE
            </Link>
          </div>
        </div>
      )}

      <nav
        className="bg-transparent relative"
        style={{ fontFamily: fontHelvetica, zIndex: 10 }}
      >
        {/* NOUVELLE RIVE + Bouton Mon Compte */}
        <div className={`px-4 md:px-6 ${showVideo ? '' : 'pt-4 md:pt-6 pb-3 md:pb-4'} flex justify-between items-start`}>
          {/* Logo - masqué quand la vidéo est affichée (déjà dans la vidéo) */}
          {!showVideo && (
            <h1
              className="uppercase"
              style={{
                fontSize: 'clamp(32px, 10vw, 72px)',
                fontWeight: '700',
                letterSpacing: '-0.01em',
                lineHeight: '1',
                color: '#000'
              }}
            >
              NOUVELLE RIVE
            </h1>
          )}

          {/* Boutons Panier + Mon Compte (cachés quand vidéo affichée) */}
          {!showVideo && (
            <div className="flex items-center gap-3 mt-1 md:mt-2">
              <LanguageSwitcher variant="light" />
              <Link
                href="/panier"
                className="relative px-3 md:px-4 py-2 border border-black hover:bg-black hover:text-white transition-all duration-200"
                style={{
                  fontSize: '9px',
                  letterSpacing: '0.1em',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}
              >
                PANIER {hydrated && count > 0 ? `(${count})` : ''}
              </Link>
              <Link
                href={compteHref}
                className="px-3 md:px-4 py-2 border border-black hover:bg-black hover:text-white transition-all duration-200"
                style={{
                  fontSize: '9px',
                  letterSpacing: '0.1em',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}
              >
                MON COMPTE
              </Link>
            </div>
          )}
        </div>

        {/* Ligne */}
        <div style={{ borderBottom: '1px solid #000' }} />

        {/* Liens en colonne - toujours visibles */}
        <div className="px-4 md:px-6 py-4 flex">
          <div className="flex flex-col gap-0.5">
            {boutiqueLinks.map((link) => {
              const active = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="nav-link transition-colors duration-200"
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    color: active ? bleuElectrique : '#000',
                    fontWeight: active ? '600' : '400',
                    lineHeight: '1.8'
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

        </div>

        {/* Ligne */}
        <div style={{ borderBottom: '1px solid #000' }} />

        {/* Animation glissante (bannière bleue) */}
        <div className="overflow-hidden py-2">
          <div className="flex items-center animate-marquee whitespace-nowrap">
            {[...Array(10)].map((_, i) => (
              <span
                key={i}
                className="mx-6 md:mx-12"
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.15em',
                  color: bleuElectrique,
                  fontWeight: '400',
                  fontStyle: 'italic'
                }}
              >
                // Livraison offerte dès 150€ d'achat // Retrait gratuit en boutique - 8 rue des Ecouffes, 75004 Paris
              </span>
            ))}
          </div>
        </div>

        {/* Ligne */}
        <div style={{ borderBottom: '1px solid #000' }} />
      </nav>

      {/* CSS pour l'animation et hover */}
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 10s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      <style jsx global>{`
        .nav-link:hover {
          color: #0000FF !important;
        }
      `}</style>
    </>
  )
}