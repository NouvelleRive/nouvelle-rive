'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { useLang, t } from '@/lib/i18n'
import { getCreatriceI18n } from '@/lib/creatricesI18n'
import FavoriteButton from '@/components/FavoriteButton'
import LazyAutoplayVideo from '@/components/LazyAutoplayVideo'

type Creatrice = {
  nom: string
  slug: string
  trigramme?: string
  specialite: string
  accroche: string
  accrocheEn?: string
  description: string
  descriptionEn?: string
  lien: string
  instagram: string
  imageUrl: string
  stockType: string
  videos?: string[]
  instagramFeatured?: string
}

// "https://www.instagram.com/reel/XYZ/?…" → "https://www.instagram.com/reel/XYZ/embed/?autoplay=1&muted=1"
function instagramEmbed(url: string): string | null {
  if (!url) return null
  const m = url.match(/instagram\.com\/(reel|p|tv)\/([^/?]+)/i)
  if (!m) return null
  return `https://www.instagram.com/${m[1]}/${m[2]}/embed/`
}

// Desktop only : si la dernière ligne (de 3) n'est pas complète, on rajoute
// la 1ère vidéo (et la 2ème si besoin) pour aligner à 3.
function padRowToThree(urls: string[], allVideos: string[]): string[] {
  if (urls.length === 0 || urls.length % 3 === 0) return urls
  if (allVideos.length === 0) return urls
  const missing = 3 - (urls.length % 3)
  const padding: string[] = []
  for (let i = 0; i < missing; i++) {
    padding.push(allVideos[i % allVideos.length])
  }
  return [...urls, ...padding]
}

type Produit = {
  id: string
  nom: string
  prix: number
  imageUrl: string
}

export default function CreateurPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.id as string
  const lang = useLang()

  const [creatrice, setCreatrice] = useState<Creatrice | null>(null)
  const [allSlugs, setAllSlugs] = useState<string[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [visibleCount, setVisibleCount] = useState(12)
  const [loading, setLoading] = useState(true)
  const [displayedText, setDisplayedText] = useState('')

  // Charger la liste des slugs (pour navigation prev/next)
  useEffect(() => {
    getDocs(collection(db, 'chineuse')).then(snap => {
      const slugs = snap.docs
        .map(d => ({ slug: d.id, ordre: d.data().ordre || 0 }))
        .sort((a, b) => a.ordre - b.ordre)
        .map(x => x.slug)
      setAllSlugs(slugs)
    }).catch(() => {})
  }, [])

  const currentIdx = allSlugs.indexOf(slug)
  const prevSlug = currentIdx > 0 ? allSlugs[currentIdx - 1] : null
  const nextSlug = currentIdx >= 0 && currentIdx < allSlugs.length - 1 ? allSlugs[currentIdx + 1] : null

        // Fetch créatrice depuis Firebase
  useEffect(() => {
    // Reset des états quand on navigue d'une chineuse à une autre
    setCreatrice(null)
    setProduits([])
    setVisibleCount(12)
    setLoading(true)

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
            accrocheEn: data.accrocheEn || '',
            description: data.description || '',
            descriptionEn: data.descriptionEn || '',
            lien: data.lien || '',
            instagram: data.instagram || '',
            imageUrl: data.imageUrl || '',
            stockType: data.stockType || '',
            videos: Array.isArray(data.videos) ? data.videos : [],
            instagramFeatured: data.instagramFeatured || '',
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
          // Tri par likesCount (champ stocké sur le produit, pas de query par-produit)
          all.sort((a: any, b: any) => (b.likesCount || 0) - (a.likesCount || 0))
          setProduits(
            all.map((p: any) => ({
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
            all.map((p: any) => ({
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

  // Infinite scroll
  useEffect(() => {
    function onScroll() {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 600
      ) {
        setVisibleCount((c) => (c < produits.length ? c + 12 : c))
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [produits.length])

  // Accroche/description selon la langue
  // Priorité : champ Firestore *En → fallback table hardcodée → fallback FR
  const fallbackEn = creatrice ? getCreatriceI18n(creatrice.slug, creatrice.nom) : null
  const accrocheLocale = creatrice
    ? (lang === 'en'
        ? (creatrice.accrocheEn || fallbackEn?.accrocheEn || creatrice.accroche)
        : creatrice.accroche)
    : ''
  const descriptionLocale = creatrice
    ? (lang === 'en'
        ? (creatrice.descriptionEn || fallbackEn?.descriptionEn || creatrice.description)
        : creatrice.description)
    : ''

  // Typewriter effect — relance à chaque changement de texte (langue)
  useEffect(() => {
    if (!accrocheLocale) return

    setDisplayedText('')
    let currentIndex = 0
    const text = accrocheLocale

    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayedText(text.slice(0, currentIndex))
        currentIndex++
      } else {
        clearInterval(interval)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [accrocheLocale])

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
    <main className="bg-white">
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

      {/* Title (flèches retirées — navigation prev/next en bas de page) */}
      <div
        id="creatrice-title"
        className="py-16 md:py-24 px-4 md:px-8 relative"
        style={{ borderBottom: '1px solid #000' }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{ background: 'radial-gradient(circle at 50% 50%, #000 0%, transparent 60%)' }}
        />
        <h1
          className="font-bold uppercase relative text-center"
          style={{
            fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
            fontSize: 'clamp(32px, 9vw, 120px)',
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
          {accrocheLocale && (
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
              {displayedText.length < accrocheLocale.length && (
                <span className="animate-pulse">|</span>
              )}
            </p>
          )}

          {/* Description */}
          {descriptionLocale && (
            <p
              className="leading-relaxed mb-8"
              style={{
                fontFamily: 'Helvetica Neue, sans-serif',
                fontSize: '14px',
                lineHeight: '1.9',
                color: '#333'
              }}
            >
              {descriptionLocale}
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
              style={{ objectPosition: (creatrice as any).imagePosition || '50% 50%' }}
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

      {/* Section Vidéos (reels Instagram) — DESKTOP : 3 cols en haut */}
      {creatrice.videos && creatrice.videos.length > 0 && (
        <div className="px-6 md:px-12 py-12 bg-white hidden sm:block" style={{ borderBottom: '1px solid #000' }}>
          <div className="grid gap-6 mx-auto grid-cols-3" style={{ maxWidth: '1280px' }}>
            {padRowToThree(creatrice.videos.slice(0, 3), creatrice.videos).map((url, i) => {
              if (/\.mp4(\?|$)/i.test(url)) {
                return (
                  <div key={`v-top-${i}`} className="w-full" style={{ aspectRatio: '9 / 16', minHeight: '500px' }}>
                    <LazyAutoplayVideo src={url} className="w-full h-full object-cover" style={{ background: '#000' }} />
                  </div>
                )
              }
              const embed = instagramEmbed(url)
              if (!embed) return null
              return (
                <div key={`v-top-${i}`} className="w-full" style={{ aspectRatio: '9 / 16', minHeight: '500px' }}>
                  <iframe src={embed} className="w-full h-full" style={{ border: 'none', background: '#fafafa' }} allowFullScreen allow="autoplay; encrypted-media" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section Produits */}
      <div className="py-8 text-center" style={{ borderBottom: '1px solid #000' }}>
        <h2
          className="uppercase tracking-widest"
          style={{ fontFamily: 'Helvetica Neue, sans-serif', fontSize: '11px', letterSpacing: '0.15em' }}
        >
          {creatrice.stockType === 'smallBatch'
            ? t('Sa collection — par les plus aimées', 'Her collection — most loved first', lang)
            : t('Toute sa collection', 'Her full collection', lang)}
        </h2>
      </div>

      {/* Grille Produits - GARDE TON DESIGN ORIGINAL */}
      {produits.length > 0 ? (
        (() => {
          const sliced = produits.slice(0, visibleCount)
          const before = sliced.slice(0, 15)
          const after = sliced.slice(15)
          const extraVideos = (creatrice.videos || []).slice(3, 6)

          const renderProducts = (list: typeof sliced, key: string) => {
            const wrapperStyle: any = { borderLeft: '1px solid #000' }
            const cols = list.length === 1 ? 'grid-cols-1' : list.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
            return (
            <div key={key} className={`grid ${cols}`} style={wrapperStyle}>
              {list.map((p) => (
                <Link
                  key={p.id}
                  href={'/boutique/' + p.id}
                  className="group flex flex-col h-full"
                  style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}
                >
                  <div className="aspect-square bg-white overflow-hidden relative">
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
                    <div className="absolute top-3 right-3 z-10">
                      <FavoriteButton productId={p.id} size={20} />
                    </div>
                  </div>
                  <div className="py-4 px-3 text-center bg-white flex-grow">
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
            )
          }

          const renderVideos = (urls: string[]) => {
            const padded = padRowToThree(urls, creatrice.videos || [])
            return (
            <div className="px-6 md:px-12 py-12 bg-white" style={{ borderBottom: '1px solid #000' }}>
              <div className="grid gap-6 mx-auto grid-cols-1 sm:grid-cols-3" style={{ maxWidth: '1280px' }}>
                {padded.map((url, i) => {
                  if (/\.mp4(\?|$)/i.test(url)) {
                    return (
                      <div key={`v-extra-${i}`} className="w-full" style={{ aspectRatio: '9 / 16', minHeight: '500px' }}>
                        <LazyAutoplayVideo src={url} className="w-full h-full object-cover" style={{ background: '#000' }} />
                      </div>
                    )
                  }
                  const embed = instagramEmbed(url)
                  if (!embed) return null
                  return (
                    <div key={`v-extra-${i}`} className="w-full" style={{ aspectRatio: '9 / 16', minHeight: '500px' }}>
                      <iframe src={embed} className="w-full h-full" style={{ border: 'none', background: '#fafafa' }} allowFullScreen allow="autoplay; encrypted-media" />
                    </div>
                  )
                })}
              </div>
            </div>
            )
          }

          // MOBILE : pattern alterné 2 vidéos côte à côte / 1 vidéo pleine largeur, 6 produits 2x2 entre
          const renderMobileAlternated = () => {
            const vids = creatrice.videos || []
            const blocks: Array<{ videoSlice: string[], productSlice: typeof sliced, bi: number }> = []
            let videoIdx = 0
            let bi = 0
            // On rend des blocs tant qu'il y a DES PRODUITS à afficher (sinon on aurait des
            // vidéos d'affilée sans rien entre, à cause du scroll infini sur les produits).
            while (bi * 6 < sliced.length) {
              const count = bi % 2 === 0 ? 2 : 1 // pair → 2 vidéos, impair → 1
              const videoSlice = vids.slice(videoIdx, videoIdx + count)
              videoIdx += videoSlice.length
              const productSlice = sliced.slice(bi * 6, bi * 6 + 6)
              if (videoSlice.length === 0 && productSlice.length === 0) break
              blocks.push({ videoSlice, productSlice, bi })
              bi++
            }
            return (
              <div className="sm:hidden">
                {blocks.map(({ videoSlice, productSlice, bi }) => {
                  const isPair = videoSlice.length === 2
                  return (
                    <div key={`mobile-${bi}`}>
                      {videoSlice.length > 0 && (
                        <div className={isPair ? 'grid grid-cols-2' : 'block'} style={{ borderTop: '1px solid #000' }}>
                          {videoSlice.map((url, vi) => (
                            <div key={`v-${vi}`} className="w-full" style={{ aspectRatio: '9 / 16', borderRight: isPair && vi === 0 ? '1px solid #000' : 'none' }}>
                              {/\.mp4(\?|$)/i.test(url) ? (
                                <LazyAutoplayVideo src={url} className="w-full h-full object-cover" style={{ background: '#000' }} />
                              ) : instagramEmbed(url) ? (
                                <iframe src={instagramEmbed(url)!} className="w-full h-full" style={{ border: 'none', background: '#fafafa' }} allowFullScreen allow="autoplay; encrypted-media" />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                      {productSlice.length > 0 && renderProducts(productSlice, `mobile-prods-${bi}`)}
                    </div>
                  )
                })}
              </div>
            )
          }

          return (
            <>
              {/* DESKTOP : layout actuel (15 prod + 3 vidéos + reste) */}
              <div className="hidden sm:block">
                {renderProducts(before, 'pre')}
                {extraVideos.length > 0 && after.length > 0 && renderVideos(extraVideos)}
                {after.length > 0 && renderProducts(after, 'post')}
              </div>
              {renderMobileAlternated()}
            </>
          )
        })()
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

      {/* Bloc instagramFeatured retiré : l'iframe Instagram embed
          buggait (sautait/affichait le chrome Insta). À remplacer par
          un slider d'images statiques (le user enverra les slides). */}

      {/* Navigation prev/next + retour */}
      <div className="py-8 flex items-center justify-between px-6 md:px-12" style={{ borderBottom: '1px solid #000' }}>
        {prevSlug ? (
          <button
            onClick={() => router.push(`/nos-creatrices/${prevSlug}`)}
            aria-label="Créatrice précédente"
            className="flex items-center gap-2 hover:opacity-50 transition-opacity"
          >
            <svg className="w-8 h-8 md:w-10 md:h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="uppercase text-xs tracking-widest hidden md:inline">{t('Précédente', 'Previous', lang)}</span>
          </button>
        ) : <span />}
        <Link
          href="/nos-creatrices"
          className="uppercase text-xs tracking-widest hover:opacity-50 text-center"
          style={{ fontFamily: 'Helvetica Neue, sans-serif' }}
        >
          {t('Toutes nos Créatrices/Curateurices', 'All our Designers / Curators', lang)}
        </Link>
        {nextSlug ? (
          <button
            onClick={() => router.push(`/nos-creatrices/${nextSlug}`)}
            aria-label="Créatrice suivante"
            className="flex items-center gap-2 hover:opacity-50 transition-opacity"
          >
            <span className="uppercase text-xs tracking-widest hidden md:inline">{t('Suivante', 'Next', lang)}</span>
            <svg className="w-8 h-8 md:w-10 md:h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : <span />}
      </div>
    </main>
  )
}