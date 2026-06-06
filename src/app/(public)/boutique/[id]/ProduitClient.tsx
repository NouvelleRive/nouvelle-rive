'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TEXTES_ECO_CIRCULAIRE, TexteEcoKey } from '@/lib/textesEcoCirculaire'
import { useCart } from '@/lib/cart'
import LazyAutoplayVideo from '@/components/LazyAutoplayVideo'
import Breadcrumbs from '@/components/Breadcrumbs'
import { useLang, t, translateCategory, translateMaterial, translateColor } from '@/lib/i18n'
import { getTypeSlug } from '@/lib/produitSlug'
import { getTypeShortLabel } from '@/lib/typeLabels'
import { LUXURY_BRANDS } from '@/lib/admin/helpers'
import { formatPrix } from '@/lib/formatPrix'

const DIACRITICS_PROD = /[̀-ͯ]/g
function slugifyMarqueLink(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(DIACRITICS_PROD, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
function isLuxuryMarque(marque?: string): boolean {
  if (!marque) return false
  const slug = slugifyMarqueLink(marque)
  return LUXURY_BRANDS.some(b => slugifyMarqueLink(b) === slug)
}

export type Produit = {
  id: string
  nom: string
  nomEn?: string
  prix: number
  imageUrls: string[]
  sku?: string
  photos?: {
    face?: string
    faceOnModel?: string
    dos?: string
    dosOnModel?: string
    details?: string[]
  }
  categorie: any
  marque?: string
  description?: string
  descriptionEn?: string
  taille?: string
  color?: string
  material?: string
  madeIn?: string
  etat?: string
  composition?: string
  entretien?: string
  vendu: boolean
  videoUrl?: string
  videos?: string[]
}

export type ChineuseInfo = {
  accroche?: string
  accrocheEn?: string
  description?: string
  descriptionEn?: string
  nom?: string
  texteEcoCirculaire?: number
  stockType?: string
  slug?: string
  trigramme?: string
  authUid?: string
}

export type SimilarProduit = {
  id: string
  nom: string
  marque?: string
  prix: number
  imageUrl: string | null
  vendu: boolean
  path: string
}

const categoriesSansTaille = ['bijoux', "boucles d'oreilles", 'colliers', 'bracelets', 'bagues', 'lunettes', 'lunettes de soleil', 'montres', 'accessoires']

function getAllImages(p: Produit): string[] {
  if (p.imageUrls?.length > 0) {
    const urls = [...p.imageUrls]
    if (p.photos) {
      ;[p.photos.face, p.photos.faceOnModel, p.photos.dos, p.photos.dosOnModel, ...(p.photos.details || [])].forEach(u => {
        if (u && !urls.includes(u)) urls.push(u)
      })
    }
    return urls
  }
  const imgs: string[] = []
  if (p.photos) {
    if (p.photos.face) imgs.push(p.photos.face)
    if (p.photos.faceOnModel) imgs.push(p.photos.faceOnModel)
    if (p.photos.dos) imgs.push(p.photos.dos)
    if (p.photos.dosOnModel) imgs.push(p.photos.dosOnModel)
    if (p.photos.details) imgs.push(...p.photos.details)
  }
  return imgs
}

function AccordionSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid #000' }}>
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center py-5 px-0 text-left transition hover:opacity-60">
        <h2 className="uppercase m-0" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '13px', letterSpacing: '0.05em', fontWeight: '400' }}>{title}</h2>
        <span className="transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '20px', fontWeight: '300' }}>∨</span>
      </button>
      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isOpen ? '500px' : '0', opacity: isOpen ? 1 : 0 }}>
        <div className="pb-6">{children}</div>
      </div>
    </div>
  )
}

export default function ProduitClient({
  produit,
  chineuseInfo,
  similarProduits = [],
  currentTypeSlug = '',
}: {
  produit: Produit
  chineuseInfo: ChineuseInfo | null
  similarProduits?: SimilarProduit[]
  currentTypeSlug?: string
}) {
  const router = useRouter()
  const lang = useLang()
  const { addItem, hasItem, hydrated } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'

  // Au montage de la page produit : scroll directement sur le produit (#titre),
  // pas sur la navbar en haut de page.
  useEffect(() => {
    const el = document.getElementById('titre')
    if (el) {
      el.scrollIntoView({ block: 'start' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [produit.id])

  const afficherTaille = (categorie: any) => {
    const catLower = (typeof categorie === 'string' ? categorie : categorie?.label || '').toLowerCase()
    return !categoriesSansTaille.some(cat => catLower.includes(cat))
  }

  const handleAjouterPanier = () => {
    const ok = addItem({
      id: produit.id,
      nom: produit.nom,
      prix: produit.prix,
      imageUrl: produit.imageUrls?.[0] || produit.photos?.face || null,
      marque: produit.marque || null,
      sku: produit.sku || null,
    })
    if (ok) {
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 1500)
    }
  }

  const dansLePanier = hasItem(produit.id)

  if (produit.vendu) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white" style={{ fontFamily: fontHelvetica }}>
        <p className="uppercase text-xs tracking-widest mb-2" style={{ color: '#999' }}>
          {t('Vendu', 'Sold', lang)}
        </p>
        <p className="text-xs mb-6" style={{ color: '#999' }}>
          {t('Cette pièce a trouvé preneur', 'This piece has found a new home', lang)}
        </p>
        <Link href="/boutique" className="uppercase text-xs tracking-widest hover:opacity-50 transition">
          {t("← Découvrir d'autres pièces", '← Discover other pieces', lang)}
        </Link>
      </div>
    )
  }

  const allImages = getAllImages(produit)
  const catRaw = typeof produit.categorie === 'string' ? produit.categorie : (produit.categorie as any)?.label || ''
  const catClean = catRaw.replace(/^[A-Z]{2,5}\s*[-–]\s*/, '').trim()

  return (
    <>
    <div id="titre" className="flex flex-col lg:flex-row bg-white" style={{ fontFamily: fontHelvetica, minHeight: 'calc(100vh - 80px)' }}>
      {/* LEFT: Photos */}
      <div className="w-full lg:w-1/2 lg:h-screen lg:overflow-y-auto lg:sticky lg:top-0" style={{ borderRight: '1px solid #000' }}>
        {allImages.length > 0 ? (
          <>
            <div className="flex flex-col">
              {/* 1ère photo en premier */}
              {allImages[0] && (
                <div className="w-full aspect-square overflow-hidden bg-white" style={{ borderBottom: '1px solid #000' }}>
                  <img src={allImages[0]} alt={`${produit.nom} - Photo 1`} className="w-full h-full object-cover" />
                </div>
              )}
              {/* Puis toutes les vidéos (mp4) */}
              {(produit.videos && produit.videos.length > 0 ? produit.videos : (produit.videoUrl ? [produit.videoUrl] : []))
                .filter(u => /\.mp4(\?|$)/i.test(u))
                .map((url, i) => (
                  <div key={`vid-${i}`} className="w-full" style={{ borderBottom: '1px solid #000' }}>
                    <LazyAutoplayVideo src={url} className="w-full h-auto" style={{ background: '#000', display: 'block' }} />
                  </div>
                ))}
              {/* Puis le reste des photos */}
              {allImages.slice(1).map((url, index) => (
                <div key={`img-${index + 1}`} className="w-full aspect-square overflow-hidden bg-white" style={{ borderBottom: '1px solid #000' }}>
                  <img src={url} alt={`${produit.nom} - Photo ${index + 2}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            {produit.photos?.faceOnModel && (
              <p style={{ fontSize: '10px', color: '#999', fontWeight: '300', padding: '8px 12px', textAlign: 'center', borderTop: '1px solid #000' }}>
                {t(
                  "Photo d'illustration générée par intelligence artificielle. Non contractuelle.",
                  'AI-generated illustrative photo. For reference only.',
                  lang
                )}
              </p>
            )}
          </>
        ) : (
          <div className="w-full h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}>
            <p className="uppercase text-xs tracking-widest" style={{ color: '#ccc' }}>{t('Pas de photo', 'No photo', lang)}</p>
          </div>
        )}
      </div>

      {/* RIGHT: Product Info */}
      <div className="w-full lg:w-1/2 lg:h-screen lg:overflow-y-auto">
        <div className="px-6 lg:px-12 py-8 lg:py-12">
          <div className="pb-8 mb-0">
            <Breadcrumbs
              typeSlug={getTypeSlug(produit.categorie)}
              marque={produit.marque}
              nom={(lang === 'en' && produit.nomEn ? produit.nomEn : produit.nom).replace(/^[A-Z]{2,10}\d{1,4}\s*[-–]\s*/i, '')}
            />
            <h1 className="uppercase mb-4">
              {produit.marque && (
                <span className="block mb-1" style={{ fontSize: '48px', letterSpacing: '0.05em', fontWeight: '700', lineHeight: '1.1' }}>
                  {produit.marque}
                </span>
              )}
              <span className="block" style={{ fontSize: '20px', letterSpacing: '0.08em', fontWeight: '300', color: '#000' }}>
                {(lang === 'en' && produit.nomEn ? produit.nomEn : produit.nom).replace(/^[A-Z]{2,10}\d{1,4}\s*[-–]\s*/i, '')}
              </span>
            </h1>
            {produit.sku && (
              <p style={{ fontSize: '0.7rem', color: '#999', marginTop: '-12px', marginBottom: '16px', letterSpacing: '0.05em' }}>
                {produit.sku}
              </p>
            )}
            <p className="mb-6" style={{ fontSize: '16px', letterSpacing: '0.02em' }}>
              {formatPrix(produit.prix)} €
            </p>
            {(lang === 'en' && produit.descriptionEn ? produit.descriptionEn : produit.description) && (
              <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#333', fontWeight: '300', whiteSpace: 'pre-wrap' }}>
                {lang === 'en' && produit.descriptionEn ? produit.descriptionEn : produit.description}
              </p>
            )}
            <p style={{ fontSize: '11px', lineHeight: '1.6', color: '#999', fontWeight: '300', marginTop: '16px' }}>
              {t(
                "Pièce vintage ou upcyclée — peut présenter quelques défauts ou traces d'usure. Vendu en l'état.",
                'Vintage or upcycled item — may show minor imperfections or signs of wear. Sold as is.',
                lang
              )}
            </p>

            <div className="mt-8 mb-6 space-y-3">
              <button
                onClick={handleAjouterPanier}
                disabled={!hydrated || dansLePanier}
                className="w-full py-4 uppercase transition hover:opacity-80 disabled:opacity-100 disabled:cursor-default"
                style={{
                  backgroundColor: dansLePanier ? '#0000FF' : '#000',
                  color: '#fff',
                  fontSize: '13px',
                  letterSpacing: '0.15em',
                  fontWeight: '400'
                }}
              >
                {justAdded
                  ? t('AJOUTÉ AU PANIER ✓', 'ADDED TO CART ✓', lang)
                  : dansLePanier
                    ? t('DÉJÀ DANS LE PANIER', 'ALREADY IN CART', lang)
                    : t('AJOUTER AU PANIER', 'ADD TO CART', lang)}
              </button>
              {dansLePanier && (
                <button
                  onClick={() => router.push('/panier')}
                  className="w-full py-4 uppercase transition hover:bg-black hover:text-white border border-black"
                  style={{ backgroundColor: '#fff', color: '#000', fontSize: '13px', letterSpacing: '0.15em', fontWeight: '400' }}
                >
                  {t('VOIR LE PANIER', 'VIEW CART', lang)}
                </button>
              )}
            </div>

            <AccordionSection title={t('Économie circulaire et engagement', 'Circular economy & commitment', lang)}>
              <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#1a1a1a', fontWeight: '400' }}>
                {(() => {
                  const key = (chineuseInfo?.texteEcoCirculaire || 1) as TexteEcoKey
                  const texte = TEXTES_ECO_CIRCULAIRE[key]
                  return <p style={{ marginBottom: '16px' }}>{lang === 'en' ? texte.en : texte.fr}</p>
                })()}
                {lang === 'en' ? (
                  <p>Every brand at NOUVELLE RIVE is committed,{' '}<Link href="/nos-creatrices" style={{ color: '#000', textDecoration: 'underline' }}>discover them</Link>.</p>
                ) : (
                  <p>Chaque marque présente chez NOUVELLE RIVE est engagée,{' '}<Link href="/nos-creatrices" style={{ color: '#000', textDecoration: 'underline' }}>découvrez-les</Link>.</p>
                )}
              </div>
            </AccordionSection>

            {(produit.marque || produit.categorie || produit.taille || produit.material || produit.color || produit.madeIn || produit.composition || produit.etat) && (
              <AccordionSection title={t('Taille et caractéristiques', 'Size & details', lang)} defaultOpen={true}>
                <div style={{ fontSize: '14px', lineHeight: '2', color: '#1a1a1a', fontWeight: '400' }}>
                  {produit.marque && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Marque', 'Brand', lang)}</span>{produit.marque}</p>
                  )}
                  {catClean && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Catégorie', 'Category', lang)}</span>{translateCategory(catClean, lang)}</p>
                  )}
                  {produit.material && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Matière', 'Material', lang)}</span>{translateMaterial(produit.material, lang)}</p>
                  )}
                  {produit.composition && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Composition', 'Composition', lang)}</span>{produit.composition}</p>
                  )}
                  {produit.color && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Couleur', 'Color', lang)}</span>{translateColor(produit.color, lang)}</p>
                  )}
                  {afficherTaille(produit.categorie) && produit.taille && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Taille', 'Size', lang)}</span>{produit.taille}</p>
                  )}
                  {produit.madeIn && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Origine', 'Origin', lang)}</span>{produit.madeIn.replace(/^Made in\s+/i, '').trim()}</p>
                  )}
                  {produit.etat && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('État', 'Condition', lang)}</span>{produit.etat}</p>
                  )}
                </div>
              </AccordionSection>
            )}

            <AccordionSection title={t('À propos de Nouvelle Rive', 'About Nouvelle Rive', lang)}>
              <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#1a1a1a', fontWeight: '400' }}>
                <p style={{ marginBottom: '12px' }}>
                  {t(
                    'Nouvelle Rive réunit des chineuses indépendantes qui sélectionnent les plus belles pièces vintage de Paris. Chaque pièce passe par notre boutique du Marais pour une vérification en main propre.',
                    'Nouvelle Rive brings together independent vintage hunters who curate the finest vintage pieces in Paris. Every item is checked in person at our Le Marais boutique.',
                    lang
                  )}
                </p>
              </div>
            </AccordionSection>

            <AccordionSection title={t('Entretien', 'Care', lang)}>
              <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>
                {produit.entretien || t(
                  "Nous recommandons un nettoyage à sec pour préserver la qualité de cette pièce. Rangez-la à l'abri de la lumière directe et de l'humidité.",
                  'We recommend dry cleaning to preserve the quality of this piece. Store away from direct sunlight and humidity.',
                  lang
                )}
              </p>
            </AccordionSection>

            {chineuseInfo && (chineuseInfo.accroche || chineuseInfo.description) && (() => {
              const accrocheLocale = lang === 'en' ? (chineuseInfo.accrocheEn || chineuseInfo.accroche) : chineuseInfo.accroche
              const descriptionLocale = lang === 'en' ? (chineuseInfo.descriptionEn || chineuseInfo.description) : chineuseInfo.description
              return (
                <AccordionSection title={chineuseInfo.stockType === 'smallBatch' ? t('Histoire de la maison', 'About the house', lang) : t('Découvrir la chineuse', 'Meet the curator', lang)}>
                  {chineuseInfo.nom && (
                    <p style={{ fontSize: '18px', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
                      {chineuseInfo.nom}
                    </p>
                  )}
                  {accrocheLocale && (
                    <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#333', fontWeight: '400', fontStyle: 'italic', marginBottom: '12px' }}>
                      {accrocheLocale}
                    </p>
                  )}
                  {descriptionLocale && (
                    <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>
                      {descriptionLocale}
                    </p>
                  )}
                </AccordionSection>
              )
            })()}

            <AccordionSection title={t('Livraison & retrait', 'Delivery & pickup', lang)}>
              <div style={{ fontSize: '13px', lineHeight: '2', color: '#666', fontWeight: '300' }}>
                {lang === 'en' ? (
                  <>
                    <p>• Free in-store pickup — 8 rue des Ecouffes, 75004 Paris</p>
                    <p>• Colissimo shipping — €15 (free from your 2nd item of the day)</p>
                    <p>• Ships within 48 business hours</p>
                    <p>• Secure payment by credit card</p>
                  </>
                ) : (
                  <>
                    <p>• Retrait gratuit en boutique — 8 rue des Ecouffes, 75004 Paris</p>
                    <p>• Livraison Colissimo — 15€ (offerte dès le 2e achat de la journée)</p>
                    <p>• Expédition sous 48h ouvrées</p>
                    <p>• Paiement sécurisé par carte bancaire</p>
                  </>
                )}
              </div>
            </AccordionSection>
          </div>
        </div>
      </div>
    </div>
    {similarProduits.length > 0 && (
      <section style={{ borderTop: '1px solid #000', fontFamily: fontHelvetica, background: '#fff' }}>
        <div className="px-6 lg:px-12 py-12">
          <h2 className="uppercase mb-8" style={{ fontSize: 'clamp(20px, 3vw, 32px)', letterSpacing: '0.05em', fontWeight: 700 }}>
            {t('Vous aimerez aussi', 'You may also like', lang)}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {similarProduits.map((p) => (
              <Link key={p.id} href={`/${p.path}`} className="group flex flex-col">
                <div className="aspect-square overflow-hidden bg-white" style={{ border: '1px solid #000' }}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.nom} className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${p.vendu ? 'opacity-50' : ''}`} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <p className="text-xs text-gray-400 uppercase">{t('Image à venir', 'Image coming soon', lang)}</p>
                    </div>
                  )}
                </div>
                <div className="py-3 text-center">
                  <h3 className="uppercase line-clamp-2 mb-1" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>
                    {p.nom.replace(/^[A-Z]{2,10}\d{1,4}\s*[-–]\s*/i, '')}
                  </h3>
                  {p.marque && (
                    <p className="uppercase mb-1 line-clamp-1" style={{ fontSize: '11px', color: '#666', letterSpacing: '0.05em' }}>{p.marque}</p>
                  )}
                  <p style={{ fontSize: '11px' }}>{formatPrix(p.prix)} €</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-6 items-start sm:items-center justify-center">
            {chineuseInfo?.slug && chineuseInfo?.nom && (
              <Link href={`/nos-creatrices/${chineuseInfo.slug}`} className="uppercase hover:underline" style={{ fontSize: '11px', letterSpacing: '0.08em', fontWeight: 600 }}>
                {chineuseInfo.stockType === 'smallBatch'
                  ? t(`Voir toutes les pièces de la créatrice ${chineuseInfo.nom}`, `See all pieces by designer ${chineuseInfo.nom}`, lang)
                  : t(`Voir toutes les pièces de la curatrice ${chineuseInfo.nom}`, `See all pieces by curator ${chineuseInfo.nom}`, lang)} →
              </Link>
            )}
            {currentTypeSlug && currentTypeSlug !== 'piece' && (
              <Link href={`/${currentTypeSlug}`} className="uppercase hover:underline" style={{ fontSize: '11px', letterSpacing: '0.08em', fontWeight: 600 }}>
                {t(`Voir tous les ${getTypeShortLabel(currentTypeSlug, 'fr').toLowerCase()}`, `See all ${getTypeShortLabel(currentTypeSlug, 'en').toLowerCase()}`, lang)} →
              </Link>
            )}
            {isLuxuryMarque(produit.marque) && produit.marque && (
              <Link href={`/designer/${slugifyMarqueLink(produit.marque)}`} className="uppercase hover:underline" style={{ fontSize: '11px', letterSpacing: '0.08em', fontWeight: 600 }}>
                {t(`Voir toutes les pièces ${produit.marque}`, `See all ${produit.marque} pieces`, lang)} →
              </Link>
            )}
          </div>
        </div>
      </section>
    )}
    </>
  )
}
