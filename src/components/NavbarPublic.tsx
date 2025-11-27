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

  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleuElectrique = '#0000FF'
  const bleuNR = '#22209C'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user)
    })
    return () => unsubscribe()
  }, [])

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
        {/* NOUVELLE RIVE + Bouton Mon Compte */}
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

          {/* Bouton Mon Compte */}
          <Link
            href={isAuthenticated ? '/client' : '/client/login'}
            className="mt-1 md:mt-2 px-3 md:px-4 py-2 border border-black hover:bg-black hover:text-white transition-all duration-200"
            style={{ 
              fontSize: '9px',
              letterSpacing: '0.1em',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}
          >
            {isAuthenticated ? 'MON COMPTE' : 'SE CONNECTER'}
          </Link>
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

          {/* SVG delulu animé - seulement sur /hiver et desktop */}
          {isHiver && (
            <div className="ml-auto hidden md:block">
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