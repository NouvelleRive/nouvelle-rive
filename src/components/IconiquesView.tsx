'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import Link from 'next/link'
import ProductGrid from '@/components/ProductGrid'
import FavoriteButton from '@/components/FavoriteButton'
import LazyAutoplayVideo from '@/components/LazyAutoplayVideo'
import { buildProduitSlug } from '@/lib/produitSlug'
import { useLang, t } from '@/lib/i18n'

export type Iconique = {
  id: string
  nom: string
  nomEn?: string
  slug: string
  dateCreation: string
  histoire: string
  histoireEn?: string
  valeurNeuf: number
  tendancePrix: 'monte' | 'descend'
  pourquoiMust: string
  pourquoiMustEn?: string
  categorieRecherche: string
  marque?: string
  chineuseTrigrammes?: string[]
  categoriesIn?: string[]
  /** Ordre de tri par catégorie (ex: ['collier', 'bague', 'broche']) — produits matchant la 1ère catégorie en premier, etc. */
  categoriesOrder?: string[]
  materialContient?: string
  images: string[]
  ordre: number
  soldOut?: boolean
  /** Lien d'achat externe (site de la créatrice) — affiché en bouton sous le bloc texte. */
  buyLink?: string
  /** URLs Instagram (reels ou posts) à embedder en bas de l'iconique. */
  videos?: string[]
  nomPluriel?: string
  nomPlurielEn?: string
  /** Label optionnel pour la section vidéos (ex: "POUR EN SAVOIR PLUS"). */
  videosLabel?: string
  videosLabelEn?: string
}

type Produit = any

// Retire l'article initial (Le/La/Les/L'/The) pour préfixer proprement par "Nos"/"Our".
// "La Veste Amadora" → "Veste Amadora", "Le Top Ana" → "Top Ana", "Les Chemises" → "Chemises".
function nomNoArticle(nom: string, lang: 'fr' | 'en'): string {
  if (!nom) return ''
  if (lang === 'en') return nom.replace(/^the\s+/i, '')
  return nom.replace(/^(les|le|la|l['’])\s*/i, '')
}

// Transforme une URL Instagram (reel/post) en URL embed compatible iframe.
// "https://www.instagram.com/reel/DQRAf8rDd8V/?igsh=…" → "https://www.instagram.com/reel/DQRAf8rDd8V/embed/?autoplay=1"
function instagramEmbed(url: string): string | null {
  if (!url) return null
  const m = url.match(/instagram\.com\/(reel|p|tv)\/([^/?]+)/i)
  if (!m) return null
  return `https://www.instagram.com/${m[1]}/${m[2]}/embed/`
}

// Extrait l'hôte d'une URL (pour libellé du bouton d'achat).
// "https://brillanteparis.fr/fr" → "brillanteparis.fr"
function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

type Props = {
  /** Filtre sur le champ `type` du doc Firestore. Absence/`'vintage'` traités comme vintage. */
  typeFilter: 'vintage' | 'upcy'
  titleFr: ReactNode
  titleEn: ReactNode
  loadingFr?: string
  loadingEn?: string
  emptyFr?: string
  emptyEn?: string
  /** Affiche "VALEUR NEUF" + "TENDANCE MARCHÉ" (utile pour vintage, pas pour upcy). */
  showMarketBlock?: boolean
  /** Si défini, le slider s'ouvre directement sur l'iconique correspondant à ce slug. */
  initialSlug?: string
}

export default function IconiquesView({
  typeFilter,
  titleFr,
  titleEn,
  loadingFr = 'Chargement des iconiques...',
  loadingEn = 'Loading icons...',
  emptyFr = 'Aucun produit iconique pour le moment',
  emptyEn = 'No iconic pieces yet',
  showMarketBlock = true,
  initialSlug,
}: Props) {
  const lang = useLang()
  const [iconiques, setIconiques] = useState<Iconique[]>([])
  const [produits, setProduits] = useState<{ [key: string]: Produit[] }>({})
  const [loadingIcons, setLoadingIcons] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  // Direction du dernier changement d'index — utilisé pour orienter l'animation de slide
  // (glissement depuis la droite quand on avance, depuis la gauche quand on recule).
  const [slideDir, setSlideDir] = useState<'forward' | 'backward'>('forward')
  // Slide sortante pendant la transition (~550ms) : l'ancienne slide part à gauche
  // pendant que la nouvelle entre par la droite. Nulle en dehors de la transition.
  const [prevIndex, setPrevIndex] = useState<number | null>(null)
  const prevTimerRef = useRef<number | null>(null)
  // Page de couverture (grille de toutes les favorites avec leur #). Affichée au 1er load,
  // désactivée quand on clique sur une tuile ou quand initialSlug/hash pointe déjà sur un item.
  const [showCover, setShowCover] = useState(true)
  const [imageIndices, setImageIndices] = useState<{ [key: string]: number }>({})
  const sliderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // 1) Iconiques via route API cachée 6h (au lieu d'un getDocs Firestore client).
        const res = await fetch(`/api/iconiques-list?type=${encodeURIComponent(typeFilter)}`)
        const json = res.ok ? await res.json() : { iconiques: [] }
        const list: any[] = Array.isArray(json.iconiques) ? json.iconiques : []
        const data: Iconique[] = list.map(docData => ({
          id: docData.id,
          nom: docData.nom || '',
          nomEn: docData.nomEn || '',
          slug: docData.slug || docData.id,
          dateCreation: docData.dateCreation || '',
          histoire: docData.histoire || '',
          histoireEn: docData.histoireEn || '',
          valeurNeuf: docData.valeurNeuf || 0,
          tendancePrix: docData.tendancePrix || 'monte',
          pourquoiMust: docData.pourquoiMust || '',
          pourquoiMustEn: docData.pourquoiMustEn || '',
          categorieRecherche: docData.categorieRecherche || '',
          marque: docData.marque || '',
          chineuseTrigrammes: docData.chineuseTrigrammes || [],
          categoriesIn: docData.categoriesIn || [],
          categoriesOrder: docData.categoriesOrder || [],
          materialContient: docData.materialContient || '',
          nomPluriel: docData.nomPluriel || '',
          nomPlurielEn: docData.nomPlurielEn || '',
          images: docData.images || [],
          ordre: docData.ordre || 0,
          soldOut: docData.soldOut === true,
          buyLink: docData.buyLink || '',
          videos: Array.isArray(docData.videos) ? docData.videos : [],
          videosLabel: docData.videosLabel || '',
          videosLabelEn: docData.videosLabelEn || '',
        }))
        if (cancelled) return
        setIconiques(data)
        const initialIndices: { [key: string]: number } = {}
        data.forEach(item => { initialIndices[item.id] = 0 })
        setImageIndices(initialIndices)
        // Si un slug initial est fourni OU si le hash pointe déjà sur un item, on skip la cover
        // et on ouvre directement sur l'iconique correspondant.
        const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : ''
        const hashN = parseInt(hash, 10)
        if (initialSlug) {
          const idx = data.findIndex(i => i.slug === initialSlug)
          if (idx >= 0) {
            setCurrentIndex(idx)
            setShowCover(false)
            requestAnimationFrame(() => {
              if (sliderRef.current) {
                sliderRef.current.scrollTo({ left: idx * sliderRef.current.offsetWidth, behavior: 'auto' })
              }
            })
          }
        } else if (!isNaN(hashN) && hashN >= 1 && hashN <= data.length) {
          setCurrentIndex(hashN - 1)
          setShowCover(false)
        }
        setLoadingIcons(false) // ← la page se rend ici, les produits sont chargés à la demande par iconique
      } catch (error) {
        console.error('Erreur lors du fetch des iconiques:', error)
        if (!cancelled) setLoadingIcons(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [typeFilter])

  // Fetch des produits pour l'iconique courant uniquement (lazy + filtré côté serveur par trigramme).
  // Avant : fetch global de TOUS les produits actifs (potentiellement des milliers) → trop lent.
  // Maintenant : fetch seulement ceux qui matchent les trigrammes de l'iconique courante, à la demande.
  useEffect(() => {
    if (iconiques.length === 0) return
    const current = iconiques[currentIndex]
    if (!current) return
    if (produits[current.id]) return // déjà chargé

    let cancelled = false

    // Fetch via /api/iconique-produits (cache Vercel 6h, servi depuis les caches
    // serveur getAllProduitsCached + getIconiquesCached). Remplace tous les
    // getDocs Firestore client — 0 read par visite (avant : jusqu'à 3000 pour
    // le slow path "luxe").
    async function fetchForCurrent() {
      try {
        const res = await fetch(`/api/iconique-produits?id=${encodeURIComponent(current.id)}`)
        const json = res.ok ? await res.json() : { produits: [] }
        if (cancelled) return
        setProduits(prev => ({ ...prev, [current.id]: Array.isArray(json.produits) ? json.produits : [] }))
      } catch (err) {
        console.error('Erreur fetch produits iconique', current.id, err)
      }
    }

    fetchForCurrent()
    return () => { cancelled = true }
  }, [currentIndex, iconiques, produits])

  // Setter unifié : maj slideDir en fonction du sens du saut, puis maj currentIndex.
  // Garde l'ancien index dans prevIndex pendant 550ms pour permettre à l'ancienne slide
  // de glisser hors écran (translateX 0 → -100% forward, 0 → 100% backward).
  const goToIndex = (newIndex: number) => {
    if (newIndex === currentIndex) return
    setSlideDir(newIndex > currentIndex ? 'forward' : 'backward')
    setPrevIndex(currentIndex)
    setCurrentIndex(newIndex)
    if (prevTimerRef.current) window.clearTimeout(prevTimerRef.current)
    prevTimerRef.current = window.setTimeout(() => setPrevIndex(null), 600)
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!sliderRef.current) return

    let newIndex = currentIndex
    if (direction === 'right' && currentIndex < iconiques.length - 1) {
      newIndex = currentIndex + 1
    } else if (direction === 'left' && currentIndex > 0) {
      newIndex = currentIndex - 1
    }

    const cardWidth = sliderRef.current.offsetWidth
    sliderRef.current.scrollTo({
      left: newIndex * cardWidth,
      behavior: 'smooth'
    })
    goToIndex(newIndex)
  }

  // Au chargement (une fois iconiques chargées), restaure la position depuis le hash URL (#N).
  useEffect(() => {
    if (iconiques.length === 0 || !sliderRef.current) return
    const h = window.location.hash.replace('#', '')
    const n = parseInt(h, 10)
    if (!isNaN(n) && n >= 1 && n <= iconiques.length) {
      const idx = n - 1
      const cardWidth = sliderRef.current.offsetWidth
      sliderRef.current.scrollTo({ left: idx * cardWidth, behavior: 'auto' })
      setCurrentIndex(idx)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconiques.length])

  // À chaque changement d'iconique courante, met à jour le hash URL sans recharger.
  // Quand on est sur la cover, on retire le hash (URL propre).
  useEffect(() => {
    if (iconiques.length === 0) return
    if (showCover) {
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      return
    }
    const newHash = `#${currentIndex + 1}`
    if (window.location.hash !== newHash) {
      history.replaceState(null, '', window.location.pathname + window.location.search + newHash)
    }
  }, [currentIndex, iconiques.length, showCover])

  useEffect(() => {
    if (iconiques.length === 0) return

    const interval = setInterval(() => {
      setImageIndices(prev => {
        const newIndices = { ...prev }
        iconiques.forEach(item => {
          if (item.images && item.images.length > 1) {
            const currentIdx = prev[item.id] || 0
            newIndices[item.id] = (currentIdx + 1) % item.images.length
          }
        })
        return newIndices
      })
    }, 7000)

    return () => clearInterval(interval)
  }, [iconiques])

  const handleMouseMove = (e: React.MouseEvent, itemId: string, totalImages: number) => {
    if (totalImages <= 1) return

    const card = e.currentTarget as HTMLElement
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const imageIndex = Math.floor(percentage * totalImages)

    setImageIndices(prev => ({
      ...prev,
      [itemId]: Math.min(imageIndex, totalImages - 1)
    }))
  }

  const handleMouseLeave = (itemId: string) => {
    setImageIndices(prev => ({ ...prev, [itemId]: 0 }))
  }

  if (loadingIcons) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="uppercase tracking-widest" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px' }}>
            {t(loadingFr, loadingEn, lang)}
          </p>
        </div>
      </main>
    )
  }

  if (iconiques.length === 0) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="uppercase tracking-widest mb-4" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px' }}>
            {t(emptyFr, emptyEn, lang)}
          </p>
          <Link href="/" className="uppercase text-xs tracking-widest underline hover:opacity-50">
            {t("Retour à l'accueil", 'Back to home', lang)}
          </Link>
        </div>
      </main>
    )
  }

  // Marquee : bandeau infini en haut avec toutes les images des iconiques (vintage + upcy).
  // Duplication ×2 pour boucle sans couture (translate -50%). Utilisé sur cover ET sur pages
  // individuelles pour garder la même taille/style de hero (demande cliente).
  const marqueeImages = iconiques.flatMap(i => (i.images && i.images.length > 0 ? [{ id: i.id, slug: i.slug, src: i.images[0], nom: i.nom, idx: iconiques.indexOf(i) }] : []))
  const renderHero = () => (
    <>
      {marqueeImages.length > 0 && (
        <style>{`
          @keyframes iconiques-marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes iconiques-marquee-intro {
            0%   { opacity: 0; transform: translateX(40px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          .iconiques-marquee-track {
            display: flex;
            width: max-content;
            height: 100%;
            animation: iconiques-marquee 45s linear infinite;
            will-change: transform;
          }
          .iconiques-marquee-intro {
            opacity: 0;
            animation: iconiques-marquee-intro 1s cubic-bezier(0.22, 1, 0.36, 1) 0.6s forwards;
            will-change: opacity, transform;
          }
          .iconiques-marquee-item {
            width: clamp(160px, 22vw, 320px);
            height: 100%;
            background: #fff;
          }
          @media (min-width: 768px) {
            .iconiques-marquee-track { animation-duration: 60s; }
          }
        `}</style>
      )}
      <div className="relative overflow-hidden" style={{ borderBottom: marqueeImages.length > 0 ? '1px solid #000' : undefined }}>
        {marqueeImages.length > 0 && (
          <div className="iconiques-marquee-intro absolute inset-0 z-0 pointer-events-auto">
            <div className="iconiques-marquee-track">
              {[...marqueeImages, ...marqueeImages].map((it, i) => (
                <button
                  key={`${it.id}-${i}`}
                  onClick={() => {
                    setSlideDir('forward')
                    setCurrentIndex(it.idx)
                    setShowCover(false)
                  }}
                  className="iconiques-marquee-item shrink-0 relative group overflow-hidden bg-white"
                  aria-label={it.nom}
                >
                  <img
                    src={it.src}
                    alt={it.nom}
                    className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="relative z-10 px-6 py-20 pointer-events-none">
          <h1
            id="titre"
            style={{
              fontSize: 'clamp(40px, 8vw, 120px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 0.9,
              textTransform: 'uppercase',
            }}
          >
            {lang === 'en' ? titleEn : titleFr}
          </h1>
        </div>
      </div>
    </>
  )

  // Vue "cover" : grille de toutes les favorites (tuile = #N + image + nom + marque).
  // Clic sur une tuile → on cache la cover et on ouvre le slider sur cet iconique.
  if (showCover) {
    return (
      <main className="bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        {renderHero()}
        <div className="w-full border-t border-black" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ borderLeft: '1px solid #000' }}>
          {iconiques.map((item, idx) => {
            const img = item.images?.[0]
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSlideDir('forward')
                  setCurrentIndex(idx)
                  setShowCover(false)
                }}
                className="relative group text-left bg-white overflow-hidden"
                style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}
              >
                <div className="aspect-square overflow-hidden bg-gray-50 relative">
                  {img ? (
                    <img
                      src={img}
                      alt={item.nom}
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                      onError={(e) => {
                        const el = e.currentTarget
                        el.style.display = 'none'
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <p className="text-gray-400 text-xs uppercase tracking-wider">{t('Image à venir', 'Image coming soon', lang)}</p>
                    </div>
                  )}
                  {/* #N en filigrane sur la tuile */}
                  <div
                    className="absolute pointer-events-none select-none"
                    style={{
                      fontSize: 'clamp(80px, 14vw, 180px)',
                      fontFamily: 'Helvetica Neue, sans-serif',
                      fontWeight: 900,
                      color: 'rgba(255,255,255,0.55)',
                      lineHeight: 1,
                      top: '4%',
                      right: '4%',
                    }}
                  >
                    #{idx + 1}
                  </div>
                </div>
                <div className="py-3 px-3 text-center">
                  <h3
                    className="uppercase font-bold line-clamp-1"
                    style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '12px', letterSpacing: '0.05em' }}
                  >
                    {lang === 'en' && item.nomEn ? item.nomEn : item.nom}
                  </h3>
                  {item.marque && (
                    <p className="mt-1 uppercase" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '10px', color: '#666', letterSpacing: '0.05em' }}>
                      {item.marque}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </main>
    )
  }

  return (
    <main className="bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      {/* Transition slide : la nouvelle slide entre par la droite pendant que l'ancienne
          sort à gauche (forward). Backward inversé. Les deux slides sont montées en même
          temps pendant ~550ms (prevIndex), puis prev est démontée. */}
      <style>{`
        @keyframes iconique-enter-fwd {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
        @keyframes iconique-enter-bwd {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(0); }
        }
        @keyframes iconique-exit-fwd {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        @keyframes iconique-exit-bwd {
          0% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
        .iconique-enter-fwd { animation: iconique-enter-fwd 0.55s cubic-bezier(0.22, 1, 0.36, 1); will-change: transform; }
        .iconique-enter-bwd { animation: iconique-enter-bwd 0.55s cubic-bezier(0.22, 1, 0.36, 1); will-change: transform; }
        .iconique-exit-fwd  { animation: iconique-exit-fwd  0.55s cubic-bezier(0.22, 1, 0.36, 1); will-change: transform; }
        .iconique-exit-bwd  { animation: iconique-exit-bwd  0.55s cubic-bezier(0.22, 1, 0.36, 1); will-change: transform; }
      `}</style>

      <div className="px-6 py-8 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid #000' }}>
        <button
          onClick={() => setShowCover(true)}
          className="uppercase text-xs tracking-widest hover:opacity-50 transition"
          style={{ fontFamily: 'Helvetica Neue, sans-serif', letterSpacing: '0.2em' }}
        >
          ← {t('Toutes les favorites', 'All favorites', lang)}
        </button>
        <span className="uppercase text-xs tracking-widest" style={{ fontFamily: 'Helvetica Neue, sans-serif', letterSpacing: '0.2em', color: '#666' }}>
          #{currentIndex + 1} / {iconiques.length}
        </span>
      </div>

      {renderHero()}
      <div className="w-full border-t border-black" />

      <div className="relative" style={{ borderBottom: '1px solid #000' }}>
        {/* MOBILE : grosses flèches à l'intersection image / titre (bas de l'image carrée) */}
        <button
          onClick={() => scroll('left')}
          aria-label="Précédent"
          className="md:hidden absolute left-2 z-20 p-1 hover:opacity-60 transition-opacity"
          style={{ top: '100vw', transform: 'translateY(-50%)' }}
        >
          <svg className="w-20 h-20 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => scroll('right')}
          aria-label="Suivant"
          className="md:hidden absolute right-2 z-20 p-1 hover:opacity-60 transition-opacity"
          style={{ top: '100vw', transform: 'translateY(-50%)' }}
        >
          <svg className="w-20 h-20 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* DESKTOP : centré verticalement sur la box image (aspect-square = 50vw → centre à 25vw) */}
        <button
          onClick={() => scroll('left')}
          aria-label="Précédent"
          className="hidden md:block absolute left-6 top-[25vw] -translate-y-1/2 z-20 p-3 hover:opacity-50 transition-opacity"
        >
          <svg className="w-14 h-14 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => scroll('right')}
          aria-label="Suivant"
          className="hidden md:block absolute right-6 top-[25vw] -translate-y-1/2 z-20 p-3 hover:opacity-50 transition-opacity"
        >
          <svg className="w-14 h-14 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div
          ref={sliderRef}
          className="relative overflow-hidden"
        >
          {iconiques.map((item, idx) => {
            const sideBySide = false
            const isActive = idx === currentIndex
            const isPrev = idx === prevIndex
            // Rien à rendre si ni active ni sortante — évite le "blanc en bas"
            // (hauteur du container = hauteur de la slide active).
            if (!isActive && !isPrev) return null
            const animClass = isPrev
              ? (slideDir === 'backward' ? 'iconique-exit-bwd' : 'iconique-exit-fwd')
              : (slideDir === 'backward' ? 'iconique-enter-bwd' : 'iconique-enter-fwd')
            return (
            <div
              key={item.id}
              className={`min-w-full ${animClass}`}
              style={{
                position: isPrev ? 'absolute' : 'relative',
                top: isPrev ? 0 : undefined,
                left: isPrev ? 0 : undefined,
                width: '100%',
                zIndex: isPrev ? 0 : 1,
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div
                  className="aspect-square bg-gray-50 overflow-hidden relative cursor-crosshair"
                  onMouseMove={(e) => handleMouseMove(e, item.id, item.images.length)}
                  onMouseLeave={() => handleMouseLeave(item.id)}
                  style={{ borderRight: '1px solid #000' }}
                >
                  {item.images && item.images.length > 0 ? (
                    <>
                      <img
                        src={item.images[imageIndices[item.id] || 0]}
                        alt={item.nom}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback si URL 404 en base : on retire l'image et laisse le placeholder.
                          const img = e.currentTarget
                          img.style.display = 'none'
                          const parent = img.parentElement
                          if (parent && !parent.querySelector('[data-placeholder]')) {
                            const div = document.createElement('div')
                            div.setAttribute('data-placeholder', '1')
                            div.className = 'w-full h-full flex items-center justify-center bg-gray-100'
                            div.innerHTML = `<p class="text-gray-400 text-xs uppercase tracking-wider">${lang === 'en' ? 'Image coming soon' : 'Image à venir'}</p>`
                            parent.appendChild(div)
                          }
                        }}
                      />
                      {item.images.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                          {item.images.map((_, idx) => (
                            <div
                              key={idx}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                background: idx === (imageIndices[item.id] || 0) ? '#000' : '#ccc'
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <p className="text-gray-400 text-xs uppercase tracking-wider">{t('Image à venir', 'Image coming soon', lang)}</p>
                    </div>
                  )}
                </div>

                <div className="px-6 pt-8 pb-6 md:p-16 lg:p-20 flex flex-col justify-center bg-white relative overflow-hidden">
                  <div
                    className="absolute pointer-events-none select-none"
                    style={{
                      fontSize: 'clamp(400px, 55vw, 600px)',
                      fontFamily: 'Helvetica Neue, sans-serif',
                      fontWeight: 900,
                      color: '#E8E8E8',
                      lineHeight: '1',
                      top: '1%',
                      left: '60%',
                      transform: 'translateX(-50%)',
                      opacity: 1,
                      zIndex: 0
                    }}
                  >
                    #{idx + 1}
                  </div>

                  <h2
                    className="font-black uppercase mb-4 relative z-10"
                    style={{
                      fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
                      fontSize: 'clamp(40px, 10vw, 55px)',
                      top: '5%',
                      letterSpacing: '-0.02em',
                      lineHeight: '0.9',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {lang === 'en' && item.nomEn ? item.nomEn : item.nom}
                  </h2>

                  {(lang === 'en' && item.pourquoiMustEn ? item.pourquoiMustEn : item.pourquoiMust) && (
                    <p
                      className="uppercase tracking-widest mb-12 relative z-10"
                      style={{
                        fontFamily: 'Helvetica Neue, sans-serif',
                        fontSize: '12px',
                        top: '3%',
                        color: '#0000FF',
                        letterSpacing: '0.25em'
                      }}
                    >
                      {lang === 'en' && item.pourquoiMustEn ? item.pourquoiMustEn : item.pourquoiMust}
                    </p>
                  )}

                  {item.dateCreation && (
                    <div className="mb-2 relative z-10">
                      <p
                        className="font-bold uppercase"
                        style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '12px', lineHeight: '1.4' }}
                      >
                        {t('DATE DE CREATION', 'YEAR CREATED', lang)} :{' '}
                        <span className="font-normal">{item.dateCreation}</span>
                      </p>
                    </div>
                  )}

                  {(lang === 'en' && item.histoireEn ? item.histoireEn : item.histoire) && (
                    <div className="mb-2 relative z-10">
                      <p
                        className="font-bold uppercase"
                        style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '12px', display: 'inline', lineHeight: '1.4' }}
                      >
                        {t('HISTOIRE', 'STORY', lang)} :{' '}
                      </p>
                      <span
                        className="font-normal"
                        style={{
                          fontFamily: 'Helvetica Neue, sans-serif',
                          fontSize: '12px',
                          lineHeight: '1.4'
                        }}
                      >
                        {lang === 'en' && item.histoireEn ? item.histoireEn : item.histoire}
                      </span>
                    </div>
                  )}

                  {showMarketBlock && (
                    <>
                      <div className="mb-2 relative z-10">
                        <p
                          className="font-bold uppercase"
                          style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '12px', lineHeight: '1.4' }}
                        >
                          {t('VALEUR NEUF', 'RETAIL VALUE', lang)} :{' '}
                          <span className="font-normal">{item.valeurNeuf.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}€</span>
                        </p>
                      </div>

                      <div className="mb-8 relative z-10">
                        <p
                          className="font-bold uppercase"
                          style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '12px', lineHeight: '1.4' }}
                        >
                          {t('TENDANCE MARCHÉ', 'MARKET TREND', lang)} :{' '}
                          <span className="font-normal lowercase">
                            {item.tendancePrix === 'monte'
                              ? t('prix en hausse', 'rising prices', lang)
                              : t('prix en baisse', 'falling prices', lang)}
                          </span>
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* MOBILE : points de progression — combien d'iconiques avant/après */}
              <div
                className="sm:hidden flex justify-center items-center gap-2 py-4 flex-wrap px-4"
                style={{ borderTop: '1px solid #000' }}
              >
                {iconiques.map((_, di) => (
                  <button
                    key={di}
                    onClick={() => goToIndex(di)}
                    aria-label={`${di + 1} / ${iconiques.length}`}
                    className="rounded-full transition-all"
                    style={{
                      width: di === idx ? 10 : 6,
                      height: di === idx ? 10 : 6,
                      background: di === idx ? '#000' : '#bbb',
                    }}
                  />
                ))}
              </div>

              {(item.buyLink || (!sideBySide && item.videos && item.videos.length > 0)) && (
                <div style={{ borderTop: '1px solid #000' }} className={`bg-white ${item.buyLink ? '' : 'hidden sm:block'}`}>
                  {item.buyLink && (
                    <div className="px-6 md:px-12 py-8 text-center" style={{ borderBottom: !sideBySide && item.videos && item.videos.length > 0 ? '1px solid #000' : 'none' }}>
                      <a
                        href={item.buyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block uppercase hover:bg-black hover:text-white transition-all duration-200"
                        style={{
                          fontFamily: 'Helvetica Neue, sans-serif',
                          fontSize: '12px',
                          letterSpacing: '0.25em',
                          padding: '14px 32px',
                          border: '1px solid #000',
                          fontWeight: 600,
                        }}
                      >
                        {t('Acheter sur', 'Shop on', lang)} {hostOf(item.buyLink)} →
                      </a>
                    </div>
                  )}
                  {!sideBySide && item.videos && item.videos.length > 0 && (
                    <div className="px-6 md:px-12 py-10">
                      <div
                        className="grid gap-6 mx-auto grid-cols-1 sm:grid-cols-2"
                        style={{
                          gridTemplateColumns: `repeat(${Math.min(item.videos.length, 3)}, minmax(0, 1fr))`,
                          maxWidth: item.videos.length === 1 ? '420px' : item.videos.length === 2 ? '880px' : '1280px',
                        }}
                      >
                        {item.videos.map((url) => {
                          if (/\.mp4(\?|$)/i.test(url)) {
                            return (
                              <div key={url} className="w-full" style={{ aspectRatio: '9 / 16' }}>
                                <LazyAutoplayVideo src={url} className="w-full h-full object-cover" style={{ background: '#000' }} />
                              </div>
                            )
                          }
                          const embed = instagramEmbed(url)
                          if (!embed) return null
                          return (
                            <div key={url} className="w-full" style={{ aspectRatio: '9 / 16' }}>
                              <iframe src={embed} className="w-full h-full" style={{ border: 'none', background: '#fafafa' }} allowFullScreen allow="autoplay; encrypted-media" />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {item.soldOut && produits[item.id] && produits[item.id].length > 0 ? (
                <div style={{ borderTop: '1px solid #000' }}>
                  <div className="px-6 md:px-12 pt-10 pb-4 flex items-baseline justify-between gap-4 flex-wrap">
                    <p
                      className="uppercase tracking-widest font-semibold"
                      style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '13px', letterSpacing: '0.2em' }}
                    >
                      {nomNoArticle(lang === 'en' && item.nomEn ? item.nomEn : item.nom, lang)}
                    </p>
                    <p
                      className="uppercase"
                      style={{
                        fontFamily: 'Helvetica Neue, sans-serif',
                        fontSize: '11px',
                        letterSpacing: '0.25em',
                        color: '#000',
                      }}
                    >
                      {t('Back in stock soon', 'Back in stock soon', lang)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4" style={{ borderTop: '1px solid #000', borderLeft: '1px solid #000' }}>
                    {produits[item.id].map((p: any) => {
                      const img = p.imageUrls?.[0] || p.imageUrl || p.photos?.face
                      return (
                        <div
                          key={p.id}
                          className="relative bg-white"
                          style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}
                        >
                          <div className="aspect-square overflow-hidden relative">
                            {img && (
                              <img
                                src={img}
                                alt={p.nom || ''}
                                className="w-full h-full object-cover"
                                style={{ filter: 'grayscale(40%)', opacity: 0.85 }}
                              />
                            )}
                            <div
                              className="absolute top-3 left-3 uppercase"
                              style={{
                                fontFamily: 'Helvetica Neue, sans-serif',
                                fontSize: '10px',
                                letterSpacing: '0.2em',
                                background: '#000',
                                color: '#fff',
                                padding: '4px 8px',
                              }}
                            >
                              {t('Vendu', 'Sold', lang)}
                            </div>
                          </div>
                          <div className="py-3 px-3 text-center">
                            <p
                              className="uppercase truncate"
                              style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px', color: '#666' }}
                            >
                              {p.nom || ''}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : item.soldOut ? (
                <div style={{ borderTop: '1px solid #000' }} className="px-6 md:px-12 py-16 text-center">
                  <p
                    className="uppercase tracking-widest"
                    style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '13px', letterSpacing: '0.25em' }}
                  >
                    {t('Back in stock soon', 'Back in stock soon', lang)}
                  </p>
                </div>
              ) : (
                produits[item.id] && produits[item.id].length > 0 && (
                  sideBySide ? (
                    <>
                      <div style={{ borderTop: '1px solid #000' }}>
                        <div className="px-6 md:px-12 pt-10 pb-4">
                          <p
                            className="uppercase tracking-widest font-semibold"
                            style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '13px', letterSpacing: '0.2em' }}
                          >
                            {t('Nos', 'Our', lang)} {(lang === 'en' ? item.nomPlurielEn : item.nomPluriel) || nomNoArticle(lang === 'en' && item.nomEn ? item.nomEn : item.nom, lang)}
                          </p>
                        </div>
                        {/* Ligne 1 : 1 vidéo (full 9/16) + 2 produits avec image étirée pour matcher la hauteur */}
                        <div className="grid grid-cols-3" style={{ borderLeft: '1px solid #000', alignItems: 'stretch' }}>
                          <div className="bg-black" style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', aspectRatio: '9 / 16' }}>
                            {(() => {
                              const url = item.videos![0]
                              if (/\.mp4(\?|$)/i.test(url)) {
                                return <LazyAutoplayVideo src={url} className="w-full h-full object-cover" />
                              }
                              const embed = instagramEmbed(url)
                              if (!embed) return null
                              return <iframe src={embed} className="w-full h-full" style={{ border: 'none', background: '#fafafa' }} allowFullScreen allow="autoplay; encrypted-media" />
                            })()}
                          </div>
                          {produits[item.id].slice(0, 2).map((p: any) => {
                            const img = p.imageUrls?.[0] || p.imageUrl || p.photos?.face
                            return (
                              <div key={p.id} className="relative flex flex-col" style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>
                                <Link href={`/${buildProduitSlug(p)}#titre`} className="flex flex-col flex-grow group">
                                  <div className="overflow-hidden bg-white flex-grow">
                                    {img && <img src={img} alt={p.nom || ''} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />}
                                  </div>
                                  <div className="py-4 px-3 text-center bg-white">
                                    <h3 className="uppercase font-semibold line-clamp-2" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '10px' }}>{p.nom}</h3>
                                    {p.marque && <p className="mt-1 uppercase" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '10px', color: '#666' }}>{p.marque}</p>}
                                    <p className="mt-1" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px' }}>{p.prix.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} €</p>
                                  </div>
                                </Link>
                                <div className="absolute top-2 right-2 z-10"><FavoriteButton productId={p.id} size={20} /></div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      {/* Reste des produits en pleine largeur */}
                      {produits[item.id].length > 2 && (
                        <div style={{ borderTop: '1px solid #000' }}>
                          <ProductGrid produits={produits[item.id].slice(2)} columns={3} showFilters={false} />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Grille produits — 3 colonnes desktop / 2 colonnes mobile via ProductGrid.
                          Un seul rendu partagé mobile+desktop : chargement plus rapide (Cloudinary
                          srcset + lazy loading) et vignettes plus grandes qu'avec l'ancien layout 4-col. */}
                      <div style={{ borderTop: '1px solid #000' }}>
                        <div className="px-6 md:px-12 pt-10 pb-4">
                          <p
                            className="uppercase tracking-widest font-semibold"
                            style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '13px', letterSpacing: '0.2em' }}
                          >
                            {t('Nos', 'Our', lang)} {(lang === 'en' ? item.nomPlurielEn : item.nomPluriel) || nomNoArticle(lang === 'en' && item.nomEn ? item.nomEn : item.nom, lang)}
                          </p>
                        </div>
                        <ProductGrid produits={produits[item.id]} columns={3} showFilters={false} />
                      </div>
                      {currentIndex < iconiques.length - 1 && (
                        <div className="sm:hidden px-6 pt-2 pb-10 text-center" style={{ borderTop: '1px solid #000' }}>
                          <button
                            onClick={() => scroll('right')}
                            className="inline-block uppercase hover:bg-black hover:text-white transition-all duration-200"
                            style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '12px', letterSpacing: '0.25em', padding: '14px 32px', border: '1px solid #000', fontWeight: 600 }}
                          >
                            {t('Favori suivant', 'Next favorite', lang)} →
                          </button>
                        </div>
                      )}
                    </>
                  )
                )
              )}
            </div>
          )})}
        </div>

        <div className="hidden md:flex justify-center items-center gap-5 py-8 flex-wrap px-4">
          {iconiques.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToIndex(idx)}
              aria-label={`Aller à l'iconique ${idx + 1}`}
              className="uppercase transition-opacity hover:opacity-70"
              style={{
                fontFamily: 'Helvetica Neue, sans-serif',
                fontSize: idx === currentIndex ? '28px' : '22px',
                fontWeight: idx === currentIndex ? 800 : 500,
                letterSpacing: '0.05em',
                color: idx === currentIndex ? '#000' : '#999',
                padding: '6px 10px',
                lineHeight: 1,
              }}
            >
              #{idx + 1}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
