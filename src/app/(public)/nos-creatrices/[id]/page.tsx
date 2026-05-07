'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { useLang, t } from '@/lib/i18n'

type Creatrice = {
  nom: string
  slug: string
  trigramme?: string
  specialite: string
  accroche: string
  description: string
  lien: string
  instagram: string
  imageUrl: string
  stockType: string
}

type Produit = {
  id: string
  nom: string
  prix: number
  imageUrl: string
}

export default function CreateurPage() {
  const params = useParams()
  const slug = params?.id as string
  const lang = useLang()

  const [creatrice, setCreatrice] = useState<Creatrice | null>(null)
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)
  const [displayedText, setDisplayedText] = useState('')

        // Fetch créatrice depuis Firebase
  useEffect(() => {
    async function fetchCreatrice() {
      if (!slug) return
      
      try {
        const docRef = doc(db, 'chineuse', slug)
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          const data = docSnap.data()
          setCreatrice({
            nom: data.nom || slug,
            slug: data.slug || slug,
            trigramme: data.trigramme || '',
            specialite: data.specialite || '',
            accroche: data.accroche || '',
            description: data.description || '',
            lien: data.lien || '',
            instagram: data.instagram || '',
            imageUrl: data.imageUrl || '',
            stockType: data.stockType || '',
          })
        }
      } catch (error) {
        console.error('Erreur lors du fetch de la créatrice:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCreatrice()
  }, [slug])

  // Fetch produits : 3 derniers (pieceUnique) ou plus likés (smallBatch)
  useEffect(() => {
    async function fetchProduitsCreatrices() {
      if (!creatrice || !creatrice.trigramme) return

      try {
        const produitsSnap = await getDocs(
          query(collection(db, 'produits'), where('trigramme', '==', creatrice.trigramme))
        )

        const all = produitsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((p: any) => {
            if (p.vendu) return false
            if ((p.quantite ?? 1) <= 0) return false
            if (p.statut === 'retour' || p.statut === 'supprime') return false
            if (p.hidden === true) return false
            if (p.forceDisplay === false) return false
            const hasImage = (p.imageUrls && p.imageUrls.length > 0) || p.imageUrl
            return !!hasImage
          })

        const isSmallBatch = creatrice.stockType === 'smallBatch'

        if (isSmallBatch) {
          const withLikes = await Promise.all(
            all.map(async (p: any) => {
              const fSnap = await getDocs(
                query(collection(db, 'favoris'), where('productId', '==', p.id))
              )
              return { p, likes: fSnap.size }
            })
          )
          withLikes.sort((a, b) => b.likes - a.likes)
          setProduits(
            withLikes.slice(0, 6).map(({ p }) => ({
              id: p.id,
              nom: p.nom || 'Produit',
              prix: p.prix || 0,
              imageUrl: p.imageUrls?.[0] || p.imageUrl || '',
            }))
          )
        } else {
          all.sort((a: any, b: any) => {
            const ta = a.createdAt?.toMillis
              ? a.createdAt.toMillis()
              : new Date(a.createdAt || 0).getTime()
            const tb = b.createdAt?.toMillis
              ? b.createdAt.toMillis()
              : new Date(b.createdAt || 0).getTime()
            return tb - ta
          })
          setProduits(
            all.slice(0, 3).map((p: any) => ({
              id: p.id,
              nom: p.nom || 'Produit',
              prix: p.prix || 0,
              imageUrl: p.imageUrls?.[0] || p.imageUrl || '',
            }))
          )
        }
      } catch (error) {
        console.error('Erreur fetch produits:', error)
      }
    }

    fetchProduitsCreatrices()
  }, [creatrice])
  
  // Scroll to title
  useEffect(() => {
    if (creatrice) {
      const titleElement = document.getElementById('creatrice-title')
      if (titleElement) {
        titleElement.scrollIntoView({ behavior: 'instant', block: 'start' })
      }
    }
  }, [creatrice])

  // Typewriter effect
  useEffect(() => {
    if (!creatrice || !creatrice.accroche) return
    
    setDisplayedText('')
    let currentIndex = 0
    const text = creatrice.accroche
    
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayedText(text.slice(0, currentIndex))
        currentIndex++
      } else {
        clearInterval(interval)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [creatrice])

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="uppercase tracking-widest" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px' }}>
            {t('Chargement...', 'Loading...', lang)}
          </p>
        </div>
      </main>
    )
  }

  if (!creatrice) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="uppercase tracking-widest mb-4" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px' }}>
            {t('Créatrice non trouvée', 'Designer not found', lang)}
          </p>
          <Link href="/nos-creatrices" className="uppercase text-xs tracking-widest underline hover:opacity-50">
            {t('Retour', 'Back', lang)}
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
          href="/nos-creatrices"
          className="uppercase text-xs tracking-widest hover:opacity-50 transition"
          style={{ fontFamily: 'Helvetica Neue, sans-serif' }}
        >
          {t('Nos Créatrices/Curateurices', 'Our Designers / Curators', lang)}
        </Link>
      </div>

      {/* Title */}
      <div 
        id="creatrice-title"
        className="py-16 md:py-24 text-center relative"
        style={{ borderBottom: '1px solid #000' }}
      >
        <div 
          className="absolute inset-0 opacity-5"
          style={{ background: 'radial-gradient(circle at 50% 50%, #000 0%, transparent 60%)' }}
        />
        <h1 
          className="font-bold uppercase relative"
          style={{ 
            fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
            fontSize: 'clamp(40px, 10vw, 120px)',
            letterSpacing: '-0.02em',
            lineHeight: '0.9',
          }}
        >
          {creatrice.nom}
        </h1>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderBottom: '1px solid #000' }}>
        {/* Text */}
        <div 
          className="p-8 md:p-12 lg:p-16 flex flex-col justify-center order-2 md:order-1"
          style={{ borderRight: '1px solid #000' }}
        >
          {/* Accroche avec typewriter */}
          {creatrice.accroche && (
            <p 
              className="uppercase font-semibold mb-8"
              style={{ 
                fontFamily: 'Helvetica Neue, sans-serif',
                fontSize: 'clamp(12px, 1.4vw, 14px)',
                letterSpacing: '0.06em',
                color: '#1e40af',
                minHeight: '24px',
                lineHeight: '1.6',
              }}
            >
              {displayedText}
              {displayedText.length < creatrice.accroche.length && (
                <span className="animate-pulse">|</span>
              )}
            </p>
          )}

          {/* Description */}
          {creatrice.description && (
            <p 
              className="leading-relaxed mb-8"
              style={{ 
                fontFamily: 'Helvetica Neue, sans-serif',
                fontSize: '14px',
                lineHeight: '1.9',
                color: '#333'
              }}
            >
              {creatrice.description}
            </p>
          )}

          {/* Liens Site et Instagram */}
          <div className="flex flex-col gap-3">
            {creatrice.lien && (
              <a
                href={creatrice.lien.startsWith('http') ? creatrice.lien : `https://${creatrice.lien}`}
                target="_blank"
                rel="noopener noreferrer"
                className="uppercase text-xs tracking-widest hover:opacity-50 transition flex items-center gap-2"
                style={{ fontFamily: 'Helvetica Neue, sans-serif' }}
              >
                <span>{t('Site web', 'Website', lang)}</span>
                <span>→</span>
              </a>
            )}
            {creatrice.instagram && (
              <a
                href={creatrice.instagram.startsWith('http') ? creatrice.instagram : `https://instagram.com/${creatrice.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="uppercase text-xs tracking-widest hover:opacity-50 transition flex items-center gap-2"
                style={{ fontFamily: 'Helvetica Neue, sans-serif' }}
              >
                <span>Instagram</span>
                <span>→</span>
              </a>
            )}
          </div>
        </div>

        {/* Image */}
        <div className="aspect-square md:aspect-auto md:min-h-[500px] bg-white overflow-hidden order-1 md:order-2">
          {creatrice.imageUrl ? (
            <img
              src={creatrice.imageUrl}
              alt={creatrice.nom}
              className="w-full h-full object-cover"
              onError={(e: any) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <p className="text-gray-400 text-xs uppercase tracking-wider">{t('Image à venir', 'Image coming soon', lang)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Section Produits */}
      <div className="py-8 text-center" style={{ borderBottom: '1px solid #000' }}>
        <h2
          className="uppercase tracking-widest"
          style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px', letterSpacing: '0.15em' }}
        >
          {creatrice.stockType === 'smallBatch'
            ? t('Ses pièces les plus aimées', 'Her most loved pieces', lang)
            : t('Ses 3 dernières pièces', 'Her latest 3 pieces', lang)}
        </h2>
      </div>

      {/* Grille Produits - GARDE TON DESIGN ORIGINAL */}
      {produits.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ borderLeft: '1px solid #000' }}>
          {produits.map((p) => (
            <Link 
              key={p.id} 
              href={'/boutique/' + p.id}
              className="group"
              style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}
            >
              <div className="aspect-square bg-white overflow-hidden">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.nom}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    onError={(e: any) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <p className="text-gray-400 text-xs uppercase">{t('Image à venir', 'Image coming soon', lang)}</p>
                  </div>
                )}
              </div>
              <div className="py-4 px-3 text-center bg-white">
                <h3 className="uppercase font-semibold" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px' }}>
                  {p.nom}
                </h3>
                <p className="mt-1 uppercase" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '10px', color: '#666' }}>
                  {creatrice.nom}
                </p>
                <p className="mt-1" style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px' }}>
                  {p.prix.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} €
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center" style={{ borderBottom: '1px solid #000' }}>
          <p
            className="uppercase tracking-widest text-gray-400"
            style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px' }}
          >
            {t('Produits à venir prochainement', 'Pieces coming soon', lang)}
          </p>
        </div>
      )}

      {/* Retour */}
      <div className="py-12 text-center" style={{ borderBottom: '1px solid #000' }}>
        <Link
          href="/nos-creatrices"
          className="uppercase text-xs tracking-widest hover:opacity-50"
          style={{ fontFamily: 'Helvetica Neue, sans-serif' }}
        >
          {t('Toutes nos Créatrices/Curateurices', 'All our Designers / Curators', lang)}
        </Link>
      </div>
    </main>
  )
}