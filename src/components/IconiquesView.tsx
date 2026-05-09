'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import Link from 'next/link'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import ProductGrid from '@/components/ProductGrid'
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
}

type Produit = any

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
          })
        })

        data.sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
        setIconiques(data)

        const initialIndices: { [key: string]: number } = {}
        data.forEach(item => { initialIndices[item.id] = 0 })
        setImageIndices(initialIndices)

        const allProduitsSnapshot = await getDocs(
          query(collection(db, 'produits'), where('vendu', '==', false))
        )
        const allProduits = allProduitsSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(p => (p.quantite ?? 1) > 0 && p.statut !== 'retour' && p.statut !== 'supprime')
          .filter(p => {
            const firstImg = p.imageUrls?.[0] || p.imageUrl || p.photos?.face
            return !!firstImg
          })

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

          const matched = allProduits.filter(p => {
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
          produitsData[item.id] = matched
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
          {iconiques.map((item) => (
            <div key={item.id} className="min-w-full snap-center">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div
                  className="aspect-square md:aspect-auto md:min-h-[560px] bg-gray-50 overflow-hidden relative cursor-crosshair"
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
                  {item.soldOut && (
                    <div
                      className="absolute top-1/2 left-1/2 pointer-events-none select-none"
                      style={{
                        transform: 'translate(-50%, -50%) rotate(-12deg)',
                        border: '6px solid #C8102E',
                        color: '#C8102E',
                        padding: '12px 36px',
                        fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
                        fontSize: 'clamp(28px, 5vw, 56px)',
                        fontWeight: 900,
                        letterSpacing: '0.1em',
                        background: 'rgba(255,255,255,0.92)',
                        boxShadow: '0 0 0 2px rgba(255,255,255,0.92) inset',
                      }}
                    >
                      SOLD OUT
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

              {item.soldOut ? (
                <div style={{ borderTop: '1px solid #000' }} className="px-6 md:px-12 py-16 text-center">
                  <p
                    className="uppercase font-bold mb-2"
                    style={{
                      fontFamily: 'Helvetica Neue, sans-serif',
                      fontSize: '14px',
                      letterSpacing: '0.25em',
                      color: '#C8102E',
                    }}
                  >
                    {t('Tout est vendu — restock bientôt', 'All sold out — restock soon', lang)}
                  </p>
                  <p
                    className="uppercase tracking-widest"
                    style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px', color: '#666' }}
                  >
                    {t(
                      `Inscris-toi à la newsletter pour être prévenu·e du retour des ${item.nom}`,
                      `Sign up for the newsletter to be notified when ${item.nomEn || item.nom} are back`,
                      lang
                    )}
                  </p>
                </div>
              ) : (
                produits[item.id] && produits[item.id].length > 0 && (
                  <div style={{ borderTop: '1px solid #000' }}>
                    <div className="px-6 md:px-12 pt-10 pb-4">
                      <p
                        className="uppercase tracking-widest font-semibold"
                        style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '13px', letterSpacing: '0.2em' }}
                      >
                        {t('Nos', 'Our', lang)} {lang === 'en' && item.nomEn ? item.nomEn : item.nom}
                      </p>
                    </div>
                    <ProductGrid produits={produits[item.id]} columns={4} showFilters={false} />
                  </div>
                )
              )}
            </div>
          ))}
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
