'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import Link from 'next/link'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import ProductGrid from '@/components/ProductGrid'
import FavoriteButton from '@/components/FavoriteButton'
import { LUXURY_BRANDS } from '@/lib/admin/helpers'
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
  materialContient?: string
  images: string[]
  ordre: number
  soldOut?: boolean
  /** Lien d'achat externe (site de la créatrice) — affiché en bouton sous le bloc texte. */
  buyLink?: string
  /** URLs Instagram (reels ou posts) à embedder en bas de l'iconique. */
  videos?: string[]
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
}: Props) {
  const lang = useLang()
  const [iconiques, setIconiques] = useState<Iconique[]>([])
  const [produits, setProduits] = useState<{ [key: string]: Produit[] }>({})
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageIndices, setImageIndices] = useState<{ [key: string]: number }>({})
  const sliderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchIconiques() {
      try {
        const querySnapshot = await getDocs(collection(db, 'iconiques'))
        const data: Iconique[] = []

        querySnapshot.forEach((doc) => {
          const docData = doc.data()
          if (docData.displayOnWebsite === false) return
          // Filtre par type : absence de type = vintage (rétro-compat).
          const docType = docData.type || 'vintage'
          if (docType !== typeFilter) return
          data.push({
            id: doc.id,
            nom: docData.nom || '',
            nomEn: docData.nomEn || '',
            slug: docData.slug || doc.id,
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
            materialContient: docData.materialContient || '',
            images: docData.images || [],
            ordre: docData.ordre || 0,
            soldOut: docData.soldOut === true,
            buyLink: docData.buyLink || '',
            videos: Array.isArray(docData.videos) ? docData.videos : [],
            videosLabel: docData.videosLabel || '',
            videosLabelEn: docData.videosLabelEn || '',
          })
        })

        data.sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
        setIconiques(data)

        const initialIndices: { [key: string]: number } = {}
        data.forEach(item => { initialIndices[item.id] = 0 })
        setImageIndices(initialIndices)

        // Pour les iconiques soldOut on a besoin des vendus aussi → on fetch tout
        // puis on partitionne ensuite.
        const hasSoldOut = data.some(d => d.soldOut)
        const allProduitsSnapshot = hasSoldOut
          ? await getDocs(collection(db, 'produits'))
          : await getDocs(query(collection(db, 'produits'), where('vendu', '==', false)))
        const baseProduits = allProduitsSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(p => p.statut !== 'retour' && p.statut !== 'supprime' && p.hidden !== true)
          .filter(p => {
            const firstImg = p.imageUrls?.[0] || p.imageUrl || p.photos?.face
            return !!firstImg
          })
        // En stock pour iconiques normaux : non vendu + qte>0
        const allProduits = baseProduits.filter(p => p.vendu !== true && (p.quantite ?? 1) > 0)

        const produitsData: { [key: string]: Produit[] } = {}
        const norm = (s: string) =>
          s.toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/['’\-_.\s]+/g, '')

        for (const item of data) {
          const needleNom = norm(item.categorieRecherche || '')
          const needleMarque = norm(item.marque || '')
          const needleMarqueRaw = (item.marque || '').toLowerCase().trim()
          const needleMaterial = norm(item.materialContient || '')
          const trigs = (item.chineuseTrigrammes || []).map(t => t.toUpperCase())
          const catsIn = (item.categoriesIn || []).map(c => norm(c))

          if (!needleNom && !needleMarque && !needleMaterial && trigs.length === 0 && catsIn.length === 0) {
            produitsData[item.id] = []
            continue
          }

          // Pour les soldOut, on cherche dans le pool complet (vendus inclus)
          // limité aux 8 derniers vendus pour l'affichage galerie.
          const sourceList = item.soldOut ? baseProduits : allProduits
          const matched = sourceList.filter(p => {
            const nom = norm(p.nom || p.Nom || '')
            const marque = norm(p.marque || '')
            const cat = typeof p.categorie === 'object'
              ? norm(p.categorie?.label || '')
              : norm(p.categorie || '')
            const material = norm(p.material || '')
            const trigramme = (p.trigramme || '').toUpperCase()

            if (needleNom && !nom.includes(needleNom) && !cat.includes(needleNom)) return false

            if (needleMarque) {
              if (needleMarqueRaw === 'luxe') {
                if (!LUXURY_BRANDS.some(b => marque.includes(norm(b)))) return false
              } else {
                if (!marque.includes(needleMarque)) return false
              }
            }

            if (trigs.length > 0 && !trigs.includes(trigramme)) return false

            if (catsIn.length > 0 && !catsIn.some(c => cat.includes(c))) return false

            if (needleMaterial && !material.includes(needleMaterial)) return false

            return true
          })
          // Pour les soldOut, on limite à 8 produits max et on tri par createdAt desc
          if (item.soldOut) {
            matched.sort((a, b) => {
              const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime()
              const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime()
              return tb - ta
            })
            produitsData[item.id] = matched.slice(0, 8)
          } else {
            produitsData[item.id] = matched
          }
        }
        setProduits(produitsData)
      } catch (error) {
        console.error('Erreur lors du fetch des iconiques:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIconiques()
  }, [typeFilter])

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
    setCurrentIndex(newIndex)
  }

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

  if (loading) {
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

  return (
    <main className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
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
          {lang === 'en' ? titleEn : titleFr}
        </h1>
      </div>
      <div className="w-full border-t border-black" />

      <div className="relative" style={{ borderBottom: '1px solid #000' }}>
        <button
          onClick={() => scroll('left')}
          className="absolute left-8 top-[25vw] md:top-[280px] -translate-y-1/2 z-10 p-4 hover:opacity-70"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => scroll('right')}
          className="absolute right-8 top-[25vw] md:top-[280px] -translate-y-1/2 z-10 p-4 hover:opacity-70"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div
          ref={sliderRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
          onScroll={(e) => {
            const container = e.currentTarget
            const scrollLeft = container.scrollLeft
            const cardWidth = container.offsetWidth
            const newIndex = Math.round(scrollLeft / cardWidth)
            setCurrentIndex(newIndex)
          }}
        >
          {iconiques.map((item) => {
            // Layout : si 1-2 vidéos + produits matchés + pas soldOut → side-by-side desktop (vidéos gauche / produits droite).
            // Si 3 vidéos ou plus → tout en pleine largeur empilé.
            const hasVideos = item.videos && item.videos.length > 0
            const hasProduits = produits[item.id] && produits[item.id].length > 0
            const sideBySide = false
            return (
            <div key={item.id} className="min-w-full snap-center">
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

                <div className="p-12 md:p-16 lg:p-20 flex flex-col justify-center bg-white relative overflow-hidden">
                  <div
                    className="absolute pointer-events-none select-none"
                    style={{
                      fontSize: 'clamp(250px, 35vw, 350px)',
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
                    #{item.ordre}
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

              {(item.buyLink || (!sideBySide && item.videos && item.videos.length > 0)) && (
                <div style={{ borderTop: '1px solid #000' }} className="bg-white">
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
                        className="grid gap-6 mx-auto"
                        style={{
                          gridTemplateColumns: `repeat(${Math.min(item.videos.length, 3)}, minmax(0, 1fr))`,
                          maxWidth: item.videos.length === 1 ? '420px' : item.videos.length === 2 ? '880px' : '1280px',
                        }}
                      >
                        {item.videos.map((url) => {
                          if (/\.mp4(\?|$)/i.test(url)) {
                            return (
                              <div key={url} className="w-full" style={{ aspectRatio: '9 / 16', minHeight: '500px' }}>
                                <video src={url} className="w-full h-full object-cover" style={{ background: '#000' }} autoPlay muted loop playsInline controls />
                              </div>
                            )
                          }
                          const embed = instagramEmbed(url)
                          if (!embed) return null
                          return (
                            <div key={url} className="w-full" style={{ aspectRatio: '9 / 16', minHeight: '500px' }}>
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
                                return <video src={url} className="w-full h-full object-cover" autoPlay muted loop playsInline controls />
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
                                <Link href={`/boutique/${p.id}`} className="flex flex-col flex-grow group">
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
                    <div style={{ borderTop: '1px solid #000' }}>
                      <div className="px-6 md:px-12 pt-10 pb-4">
                        <p
                          className="uppercase tracking-widest font-semibold"
                          style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '13px', letterSpacing: '0.2em' }}
                        >
                          {t('Nos', 'Our', lang)} {(lang === 'en' ? item.nomPlurielEn : item.nomPluriel) || nomNoArticle(lang === 'en' && item.nomEn ? item.nomEn : item.nom, lang)}
                        </p>
                      </div>
                      <ProductGrid produits={produits[item.id]} columns={4} showFilters={false} />
                    </div>
                  )
                )
              )}
            </div>
          )})}
        </div>

        <div className="flex justify-center gap-2 py-6">
          {iconiques.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className="w-2 h-2 rounded-full"
              style={{
                background: idx === currentIndex ? '#000' : '#ccc',
                transform: idx === currentIndex ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
