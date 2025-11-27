// src/components/NavbarPublic.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'

export default function NavbarPublic() {
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleuElectrique = '#0000FF'
  const bleuNR = '#22209C'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user)
    })
    return () => unsubscribe()
  }, [])

  // Fermer le menu quand on change de page
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Contenu de navigation
  const boutiqueLinks = [
    { href: '/boutique', label: 'TOUT VOIR' },
    { href: '/new-in', label: 'NEW IN' },
    { href: '/hiver', label: 'HIVER' },
    { href: '/soiree', label: 'SOIRÉE' },
    { href: '/les-iconiques', label: 'LES ICONIQUES DU VINTAGE' },
    { href: '/le-luxe', label: 'LE LUXE' },
    { href: '/coups-de-coeur', label: 'NOS PIÈCES PRÉFÉRÉES' },
    { href: '/nos-creatrices', label: 'NOS CRÉATRICES/CURATEURICES' },
    { href: '/boutique/femme', label: '(PLUTÔT) FEMME' },
    { href: '/boutique/homme', label: '(PLUTÔT) HOMME' },
    { href: '/boutique/enfant', label: 'ENFANT' },
    { href: '/boutique/accessoires', label: 'ACCESSOIRES' },
    { href: '/nous-rencontrer', label: '8 RUE DES ECOUFFES #IRL' },
  ]

  const isHiver = pathname === '/hiver'

  return (
    <>
      <nav 
        className="bg-transparent relative"
        style={{ fontFamily: fontHelvetica, zIndex: 10 }}
      >
        {/* NOUVELLE RIVE + Boutons */}
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 flex justify-between items-start">
          {/* Logo - taille responsive */}
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

          {/* Boutons desktop + hamburger mobile */}
          <div className="flex items-center gap-3 mt-1 md:mt-2">
            {/* Bouton Mon Compte - caché sur très petit mobile */}
            <Link
              href={isAuthenticated ? '/client' : '/client/login'}
              className="hidden sm:block px-3 md:px-4 py-2 border border-black hover:bg-black hover:text-white transition-all duration-200"
              style={{ 
                fontSize: '10px',
                letterSpacing: '0.15em',
                fontWeight: '600'
              }}
            >
              {isAuthenticated ? 'MON COMPTE' : 'SE CONNECTER'}
            </Link>

            {/* Hamburger - visible uniquement sur mobile */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex flex-col justify-center items-center w-8 h-8"
              aria-label="Menu"
            >
              <span 
                className="block w-6 h-0.5 bg-black transition-all duration-300"
                style={{
                  transform: menuOpen ? 'rotate(45deg) translateY(4px)' : 'none'
                }}
              />
              <span 
                className="block w-6 h-0.5 bg-black my-1 transition-all duration-300"
                style={{
                  opacity: menuOpen ? 0 : 1
                }}
              />
              <span 
                className="block w-6 h-0.5 bg-black transition-all duration-300"
                style={{
                  transform: menuOpen ? 'rotate(-45deg) translateY(-4px)' : 'none'
                }}
              />
            </button>
          </div>
        </div>

        {/* Ligne */}
        <div style={{ borderBottom: '1px solid #000' }} />

        {/* Animation glissante */}
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
                // Livraison offerte dès 2 articles // Retrait gratuit en boutique - 8 rue des Ecouffes, 75004 Paris // -15% sur le troisième article
              </span>
            ))}
          </div>
        </div>

        {/* Ligne */}
        <div style={{ borderBottom: '1px solid #000' }} />

        {/* Navigation Desktop - cachée sur mobile */}
        <div className="hidden md:flex px-6 py-4">
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

          {/* SVG delulu animé - seulement sur /hiver */}
          {isHiver && (
            <div className="ml-auto">
              <object 
                type="image/svg+xml"
                data="/images/delulu-animated.svg"
                className="w-72"
              >
                may all your delulu come trululu
              </object>
            </div>
          )}
        </div>

        {/* Navigation Mobile - menu déroulant */}
        <div 
          className="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: menuOpen ? '600px' : '0',
            opacity: menuOpen ? 1 : 0
          }}
        >
          <div className="px-4 py-4 flex flex-col gap-1 bg-white">
            {/* Lien compte sur mobile */}
            <Link
              href={isAuthenticated ? '/client' : '/client/login'}
              className="sm:hidden py-2 border-b border-gray-200 mb-2"
              style={{ 
                fontSize: '11px',
                letterSpacing: '0.15em',
                fontWeight: '600',
                color: bleuElectrique
              }}
            >
              {isAuthenticated ? 'MON COMPTE' : 'SE CONNECTER'}
            </Link>

            {boutiqueLinks.map((link) => {
              const active = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="nav-link transition-colors duration-200 py-1"
                  style={{
                    fontSize: '12px',
                    letterSpacing: '0.15em',
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

        {/* Ligne (visible seulement si menu fermé sur mobile, toujours sur desktop) */}
        <div 
          className="hidden md:block"
          style={{ borderBottom: '1px solid #000' }} 
        />
        <div 
          className="md:hidden"
          style={{ borderBottom: menuOpen ? '1px solid #000' : 'none' }} 
        />
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