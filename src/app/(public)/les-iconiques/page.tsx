'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

type Iconique = {
  id: string
  nom: string
  slug: string
  dateCreation: string
  histoire: string
  valeurNeuf: number
  tendancePrix: 'monte' | 'descend'
  pourquoiMust: string
  categorieRecherche: string
  images: string[]
  ordre: number
}

type Produit = {
  id: string
  nom: string
  prix: number
  imageUrl: string
  slug: string
}

export default function LesIconiquesPage() {
  const [iconiques, setIconiques] = useState<Iconique[]>([])
  const [produits, setProduits] = useState<{ [key: string]: Produit[] }>({})
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageIndices, setImageIndices] = useState<{ [key: string]: number }>({})
  const sliderRef = useRef<HTMLDivElement>(null)

  // Fetch iconiques depuis Firebase
  useEffect(() => {
    async function fetchIconiques() {
      try {
        const q = query(
          collection(db, 'iconiques'),
          where('displayOnWebsite', '==', true),
          orderBy('ordre', 'asc')
        )
        
        const querySnapshot = await getDocs(q)
        const data: Iconique[] = []
        
        querySnapshot.forEach((doc) => {
          const docData = doc.data()
          data.push({
            id: doc.id,
            nom: docData.nom || '',
            slug: docData.slug || doc.id,
            dateCreation: docData.dateCreation || '',
            histoire: docData.histoire || '',
            valeurNeuf: docData.valeurNeuf || 0,
            tendancePrix: docData.tendancePrix || 'monte',
            pourquoiMust: docData.pourquoiMust || '',
            categorieRecherche: docData.categorieRecherche || '',
            images: docData.images || [],
            ordre: docData.ordre || 0,
          })
        })
        
        setIconiques(data)
        
        // Initialise les index d'images
        const initialIndices: { [key: string]: number } = {}
        data.forEach(item => {
          initialIndices[item.id] = 0
        })
        setImageIndices(initialIndices)

        // Fetch produits pour chaque iconique
        const produitsData: { [key: string]: Produit[] } = {}
        for (const item of data) {
          try {
            const qProduits = query(
              collection(db, 'produits'),
              where('Catégorie', 'array-contains', item.categorieRecherche)
            )
            const produitsSnapshot = await getDocs(qProduits)
            const itemProduits: Produit[] = []
            produitsSnapshot.forEach((doc) => {
              const pData = doc.data()
              itemProduits.push({
                id: doc.id,
                nom: pData.nom || pData.Nom || '',
                prix: pData.prix || pData.Prix || 0,
                imageUrl: pData.imageUrl || pData.ImageURL || '',
                slug: pData.slug || doc.id
              })
            })
            produitsData[item.id] = itemProduits.slice(0, 6) // Max 6 produits
          } catch (error) {
            console.error(`Erreur fetch produits pour ${item.nom}:`, error)
            produitsData[item.id] = []
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
  }, [])

  // Navigation manuelle avec boutons < >
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

  // Auto-scroll des images de chaque produit toutes les 7 secondes
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

  // Change image au hover (Rick Owens style)
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
    setImageIndices(prev => ({
      ...prev,
      [itemId]: 0
    }))
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="uppercase tracking-widest" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px' }}>
            Chargement des iconiques...
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
            Aucun produit iconique pour le moment
          </p>
          <Link href="/" className="uppercase text-xs tracking-widest underline hover:opacity-50">
            Retour à l'accueil
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="py-4 px-6 text-center" style={{ borderBottom: '1px solid #000' }}>
        <Link 
          href="/"
          className="uppercase text-xs tracking-widest hover:opacity-50"
          style={{ fontFamily: 'Helvetica Neue, sans-serif' }}
        >
          Les Iconiques du Vintage
        </Link>
      </div>

      {/* Slider Rick Owens Style */}
      <div className="relative" style={{ borderBottom: '1px solid #000' }}>
        {/* Navigation buttons */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-8 top-1/2 -translate-y-1/2 z-10 p-4 hover:opacity-70"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <button
          onClick={() => scroll('right')}
          className="absolute right-8 top-1/2 -translate-y-1/2 z-10 p-4 hover:opacity-70"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Slider container */}
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
            <div
              key={item.id}
              className="min-w-full snap-center"
            >
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Image avec effet Rick Owens */}
                <div
                  className="aspect-square md:aspect-auto md:min-h-[700px] bg-gray-50 overflow-hidden relative cursor-crosshair"
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
                      {/* Indicateur d'images multiples */}
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
                      <p className="text-gray-400 text-xs uppercase tracking-wider">Image à venir</p>
                    </div>
                  )}
                </div>

                {/* Info éditoriale */}
                <div className="p-12 md:p-16 lg:p-20 flex flex-col justify-start bg-white relative overflow-hidden">
                  {/* Numéro géant en arrière-plan */}
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

                  {/* Nom */}
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
                    {item.nom}
                  </h2>

                  {/* Catchphrase = pourquoiMust */}
                  {item.pourquoiMust && (
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
                      {item.pourquoiMust}
                    </p>
                  )}

                  {/* Date de création */}
                  {item.dateCreation && (
                    <div className="mb-2 relative z-10">
                      <p 
                        className="font-bold uppercase"
                        style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '12px', lineHeight: '1.4' }}
                      >
                        DATE DE CREATION :{' '}
                        <span className="font-normal">{item.dateCreation}</span>
                      </p>
                    </div>
                  )}

                  {/* Histoire */}
                  {item.histoire && (
                    <div className="mb-2 relative z-10">
                      <p 
                        className="font-bold uppercase"
                        style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '12px', display: 'inline', lineHeight: '1.4' }}
                      >
                        HISTOIRE :{' '}
                      </p>
                      <span 
                        className="font-normal"
                        style={{ 
                          fontFamily: 'Helvetica Neue, sans-serif',
                          fontSize: '12px',
                          lineHeight: '1.4'
                        }}
                      >
                        {item.histoire}
                      </span>
                    </div>
                  )}

                  {/* Valeur neuf */}
                  <div className="mb-2 relative z-10">
                    <p 
                      className="font-bold uppercase"
                      style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '12px', lineHeight: '1.4' }}
                    >
                      VALEUR NEUF :{' '}
                      <span className="font-normal">{item.valeurNeuf.toLocaleString('fr-FR')}€</span>
                    </p>
                  </div>

                  {/* Tendance marché */}
                  <div className="mb-8 relative z-10">
                    <p 
                      className="font-bold uppercase"
                      style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '12px', lineHeight: '1.4' }}
                    >
                      TENDANCE MARCHÉ :{' '}
                      <span className="font-normal lowercase">
                        {item.tendancePrix === 'monte' ? 'prix en hausse' : 'prix en baisse'}
                      </span>
                    </p>
                  </div>

                  {/* Produits correspondants */}
                  {produits[item.id] && produits[item.id].length > 0 && (
                    <div className="mt-8 pt-8 relative z-10" style={{ borderTop: '1px solid #e5e5e5' }}>
                      <p 
                        className="uppercase tracking-wider text-xs mb-4 font-semibold"
                        style={{ fontFamily: 'Helvetica Neue, sans-serif' }}
                      >
                        Nos {item.nom}
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {produits[item.id].map((produit) => (
                          <Link
                            key={produit.id}
                            href={`/boutique/${produit.slug}`}
                            className="group"
                          >
                            <div 
                              className="aspect-square bg-gray-100 mb-2 overflow-hidden"
                              style={{ border: '1px solid #000' }}
                            >
                              {produit.imageUrl ? (
                                <img
                                  src={produit.imageUrl}
                                  alt={produit.nom}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <p className="text-gray-400 text-xs">Image à venir</p>
                                </div>
                              )}
                            </div>
                            <p 
                              className="text-xs mb-1 line-clamp-2"
                              style={{ fontFamily: 'Helvetica Neue, sans-serif' }}
                            >
                              {produit.nom}
                            </p>
                            <p 
                              className="text-xs font-semibold"
                              style={{ fontFamily: 'Helvetica Neue, sans-serif' }}
                            >
                              {produit.prix} €
                            </p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dots navigation */}
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