// src/components/NavbarPublic.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import { useCart } from '@/lib/cart'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLang, t } from '@/lib/i18n'

export default function NavbarPublic() {
  const pathname = usePathname()
  const lang = useLang()
  const [compteHref, setCompteHref] = useState('/client/login')
  const { count, hydrated } = useCart()
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = pathname === '/'
  const [stickyVisible, setStickyVisible] = useState(false)
  const [stickyMenuOpen, setStickyMenuOpen] = useState(false)

  // Barre sticky : apparaît après ~120px de scroll (quand la barre boutons du haut a disparu).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onScroll = () => setStickyVisible(window.scrollY > 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Ferme le menu sticky à chaque changement de page
  useEffect(() => { setStickyMenuOpen(false) }, [pathname])

  // Force ralenti 0.25× + relance .play() au cas où autoplay aurait été bloqué
  // (iOS mode éco, etc.). On REapplique playbackRate à chaque event car certains
  // navigateurs (Safari iOS) le remettent à 1 sur play()/loadedmetadata.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const apply = () => {
      v.playbackRate = 0.25
      v.muted = true
      v.play().catch(() => {})
    }
    apply()
    v.addEventListener('loadedmetadata', apply)
    v.addEventListener('canplay', apply)
    v.addEventListener('play', () => { v.playbackRate = 0.25 })
    return () => {
      v.removeEventListener('loadedmetadata', apply)
      v.removeEventListener('canplay', apply)
    }
  }, [showVideo])

  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleuElectrique = '#0000FF'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCompteHref(user ? '/client' : '/client/login')
    })
    return () => unsubscribe()
  }, [])

  // Sur mobile, les pages catégorie affichent un loader pendant le fetch des produits,
  // donc #titre n'existe pas encore quand le navigateur tente de scroller au hash.
  // On retente jusqu'à ce que l'élément apparaisse (max ~2s). scrollIntoView() respecte
  // le scroll-margin-top défini en CSS global plus bas.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash) return
    let cancelled = false
    let tries = 0
    const tick = () => {
      if (cancelled) return
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ block: 'start' })
        return
      }
      tries++
      if (tries < 40) setTimeout(tick, 50)
    }
    tick()
    return () => { cancelled = true }
  }, [pathname])

  // Hash #titre : chaque page de destination a un id="titre" sur son h1 principal.
  // Le navigateur (et Next.js) scrollent automatiquement à cet ancrage à l'arrivée,
  // ce qui place le titre de la page en haut du viewport (la navbar passe au-dessus).
  const boutiqueLinks = [
    { href: '/ete#titre', label: t('ÉTÉ', 'SUMMER', lang) },
    { href: '/sac', label: t('SACS HAUTE COUTURE ET JEUNES CRÉATRICES', 'HAUTE COUTURE & YOUNG DESIGNER BAGS', lang) },
    { href: '/luxe#titre', label: t('LE LUXE', 'LUXURY', lang) },
    { href: '/iconiques-upcy', label: t('NOS PIÈCES UPCY FAVORITES', 'FAVORITE UPCYCLED PIECES', lang) },
    { href: '/les-iconiques', label: t('LES ICONIQUES DU VINTAGE', 'VINTAGE ICONICS', lang) },
    { href: '/coups-de-coeur#titre', label: t('NOS PIÈCES PRÉFÉRÉES', 'OUR FAVORITE GEMS', lang) },
    { href: '/soiree#titre', label: t('SOIRÉE', 'EVENING', lang) },
    { href: '/nos-creatrices#titre', label: t('NOS CRÉATRICES/CURATEURICES', 'OUR DESIGNERS / CURATORS', lang) },
    { href: '/nous-rencontrer#titre', label: t('IRL : NOTRE BOUTIQUE 8 RUE DES ECOUFFES', 'IRL: OUR BOUTIQUE — 8 RUE DES ECOUFFES', lang) },
    { href: '/boutique', label: t('TOUT VOIR', 'SEE ALL', lang) },
  ]

  const cartLabel = t('PANIER', 'CART', lang)
  const accountLabel = t('MON COMPTE', 'MY ACCOUNT', lang)
  const marqueeText = t(
    "// Livraison offerte dès 150€ d'achat // Retrait gratuit en boutique - 8 rue des Ecouffes, 75004 Paris",
    '// Free shipping over €150 // Free in-store pickup — 8 rue des Ecouffes, 75004 Paris',
    lang
  )

  const menuLabel = t('MENU', 'MENU', lang)

  return (
    <>
      {/* Barre sticky toujours dispo en scroll : MENU + PANIER + COMPTE */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-200 ${stickyVisible ? 'translate-y-0' : '-translate-y-full pointer-events-none'}`}
        style={{ fontFamily: fontHelvetica }}
        aria-hidden={!stickyVisible}
      >
        <div className="bg-white border-b border-black px-3 md:px-6 py-2 flex items-center justify-end gap-1.5 md:gap-3">
          <button
            type="button"
            onClick={() => setStickyMenuOpen((o) => !o)}
            className="px-1.5 md:px-4 py-1 md:py-2 border border-black hover:bg-black hover:text-white transition-all duration-200 text-[8px] md:text-[9px]"
            style={{
              letterSpacing: '0.08em',
              fontWeight: '600',
              whiteSpace: 'nowrap',
            }}
            aria-expanded={stickyMenuOpen}
            aria-controls="sticky-menu-panel"
          >
            {menuLabel}
          </button>
          <Link
            href="/panier"
            className="relative px-1.5 md:px-4 py-1 md:py-2 border border-black hover:bg-black hover:text-white transition-all duration-200 text-[8px] md:text-[9px]"
            style={{
              letterSpacing: '0.08em',
              fontWeight: '600',
              whiteSpace: 'nowrap',
            }}
          >
            {cartLabel} {hydrated && count > 0 ? `(${count})` : ''}
          </Link>
          <Link
            href={compteHref}
            className="px-1.5 md:px-4 py-1 md:py-2 border border-black hover:bg-black hover:text-white transition-all duration-200 text-[8px] md:text-[9px]"
            style={{
              letterSpacing: '0.08em',
              fontWeight: '600',
              whiteSpace: 'nowrap',
            }}
          >
            {accountLabel}
          </Link>
        </div>
        {stickyMenuOpen && (
          <div
            id="sticky-menu-panel"
            className="bg-white border-b border-black px-4 md:px-6 py-4 max-h-[70vh] overflow-y-auto"
          >
            <div className="flex flex-col gap-0.5">
              {boutiqueLinks.map((link) => {
                const linkPath = link.href.split('#')[0]
                const active = pathname === linkPath
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setStickyMenuOpen(false)}
                    className="nav-link transition-colors duration-200"
                    style={{
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      color: active ? bleuElectrique : '#000',
                      fontWeight: active ? '600' : '400',
                      lineHeight: '1.8',
                    }}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Vidéo bannière (boutique uniquement) */}
      {showVideo && (
        <div className="relative w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            src="/banner.mp4?v=2"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="w-full h-[45vh] md:h-screen object-cover block"
          />
          {/* Logo top-left blanc sur la vidéo (homepage : pas de fond blanc) */}
          <div
            className="absolute top-4 left-4 md:top-6 md:left-6 z-10 flex items-center"
            style={{ fontFamily: fontHelvetica }}
          >
            <div
              className="uppercase whitespace-nowrap"
              style={{
                fontSize: 'clamp(16px, 3vw, 28px)',
                fontWeight: '700',
                letterSpacing: '-0.01em',
                lineHeight: '1',
                color: '#fff',
              }}
            >
              NOUVELLE RIVE
            </div>
          </div>
          {/* Boutons top-right blancs sur la vidéo */}
          <div
            className="absolute top-4 right-4 md:top-6 md:right-6 flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-3 z-10"
            style={{ fontFamily: fontHelvetica }}
          >
            <div className="order-1 md:order-2 flex items-center gap-2 md:gap-3">
              <Link
                href="/panier"
                className="relative px-1.5 md:px-4 py-1 md:py-2 border border-white text-white bg-black/30 backdrop-blur-sm hover:bg-white hover:text-black transition-all duration-200 text-[8px] md:text-[9px]"
                style={{
                  letterSpacing: '0.08em',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}
              >
                {cartLabel} {hydrated && count > 0 ? `(${count})` : ''}
              </Link>
              <Link
                href={compteHref}
                className="px-1.5 md:px-4 py-1 md:py-2 border border-white text-white bg-black/30 backdrop-blur-sm hover:bg-white hover:text-black transition-all duration-200 text-[8px] md:text-[9px]"
                style={{
                  letterSpacing: '0.08em',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}
              >
                {accountLabel}
              </Link>
            </div>
            <div className="order-2 md:order-1 scale-75 md:scale-100 origin-top-right">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}

      <nav
        className={`relative ${showVideo ? 'bg-transparent' : 'bg-white'}`}
        style={{ fontFamily: fontHelvetica, zIndex: 10 }}
      >
        <div className={`px-4 md:px-6 ${showVideo ? '' : 'pt-4 md:pt-6 pb-3 md:pb-4'} flex flex-col gap-2`}>
          {!showVideo && (
            <div className="flex justify-between items-center gap-3">
              <div
                className="uppercase whitespace-nowrap"
                style={{
                  fontSize: 'clamp(20px, 6vw, 72px)',
                  fontWeight: '700',
                  letterSpacing: '-0.01em',
                  lineHeight: '1',
                  color: '#000'
                }}
              >
                NOUVELLE RIVE
              </div>
              <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
                <Link
                  href="/panier"
                  className="relative px-1.5 md:px-4 py-1 md:py-2 border border-black hover:bg-black hover:text-white transition-all duration-200 text-[8px] md:text-[9px]"
                  style={{
                    letterSpacing: '0.08em',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cartLabel} {hydrated && count > 0 ? `(${count})` : ''}
                </Link>
                <Link
                  href={compteHref}
                  className="px-1.5 md:px-4 py-1 md:py-2 border border-black hover:bg-black hover:text-white transition-all duration-200 text-[8px] md:text-[9px]"
                  style={{
                    letterSpacing: '0.08em',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {accountLabel}
                </Link>
              </div>
            </div>
          )}

          {!showVideo && (
            <div className="flex justify-end">
              <div className="scale-75 md:scale-100 origin-top-right">
                <LanguageSwitcher />
              </div>
            </div>
          )}
        </div>

        <div style={{ borderBottom: '1px solid #000' }} />

        {/* Onglets toujours visibles (liste verticale, comme avant) */}
        <div className="px-4 md:px-6 py-4 flex">
          <div className="flex flex-col gap-0.5">
            {boutiqueLinks.map((link) => {
              const linkPath = link.href.split('#')[0]
              const active = pathname === linkPath
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

        <div style={{ borderBottom: '1px solid #000' }} />

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
                {marqueeText}{' '}
                <span style={{ fontWeight: 700 }}>// WORLD WIDE DELIVERY</span>
              </span>
            ))}
          </div>
        </div>

        <div style={{ borderBottom: '1px solid #000' }} />
      </nav>

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
        /* Marge respirable au-dessus du titre quand on arrive via #titre */
        #titre {
          scroll-margin-top: 40px;
        }
        @media (min-width: 768px) {
          #titre {
            scroll-margin-top: 80px;
          }
        }
      `}</style>
    </>
  )
}
