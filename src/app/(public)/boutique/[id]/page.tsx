// src/app/(public)/boutique/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import Link from 'next/link'
import { TEXTES_ECO_CIRCULAIRE, TexteEcoKey } from '@/lib/textesEcoCirculaire'
import { useCart } from '@/lib/cart'
import { useLang, t } from '@/lib/i18n'

type Produit = {
  id: string
  nom: string
  prix: number
  imageUrls: string[]
  photos?: {
    face?: string
    faceOnModel?: string
    dos?: string
    details?: string[]
  }
  categorie: string
  marque?: string
  description?: string
  taille?: string
  color?: string
  material?: string
  madeIn?: string
  etat?: string
  composition?: string
  entretien?: string
  vendu: boolean
}

// Catégories qui n'ont pas de taille
const categoriesSansTaille = ['bijoux', 'boucles d\'oreilles', 'colliers', 'bracelets', 'bagues', 'lunettes', 'lunettes de soleil', 'montres', 'accessoires']

function getAllImages(p: Produit): string[] {
  // Priorité à imageUrls (respecte l'ordre défini)
  if (p.imageUrls?.length > 0) {
  const urls = [...p.imageUrls]
  if (p.photos) {
    ;[p.photos.face, p.photos.faceOnModel, p.photos.dos, (p.photos as any).dosOnModel, ...(p.photos.details || [])].forEach(u => { if (u && !urls.includes(u)) urls.push(u) })
  }
  return urls
}
  
  // Fallback sur photos structurées
  const imgs: string[] = []
  if (p.photos) {
    if (p.photos.face) imgs.push(p.photos.face)
    if (p.photos.faceOnModel) imgs.push(p.photos.faceOnModel)
    if (p.photos.dos) imgs.push(p.photos.dos)
    if ((p.photos as any).dosOnModel) imgs.push((p.photos as any).dosOnModel)
    if (p.photos.details) imgs.push(...p.photos.details)
  }
  return imgs
}

// Composant Section Dépliable
function AccordionSection({ 
  title, 
  children, 
  defaultOpen = false 
}: { 
  title: string
  children: React.ReactNode
  defaultOpen?: boolean 
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div style={{ borderBottom: '1px solid #000' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center py-5 px-0 text-left transition hover:opacity-60"
      >
        <span 
          className="uppercase"
          style={{ 
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: '13px',
            letterSpacing: '0.05em',
            fontWeight: '400'
          }}
        >
          {title}
        </span>
        <span 
          className="transition-transform duration-300"
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            fontSize: '20px',
            fontWeight: '300'
          }}
        >
          ∨
        </span>
      </button>
      
      <div 
        className="overflow-hidden transition-all duration-300"
        style={{ 
          maxHeight: isOpen ? '500px' : '0',
          opacity: isOpen ? 1 : 0
        }}
      >
        <div className="pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function ProduitPage() {
  const params = useParams()
  const router = useRouter()
  const [produit, setProduit] = useState<Produit | null>(null)
  const [loading, setLoading] = useState(true)
  const [chineuseInfo, setChineuseInfo] = useState<{accroche?: string, description?: string, nom?: string, texteEcoCirculaire?: number, stockType?: string} | null>(null)
  const { addItem, hasItem, hydrated } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const lang = useLang()

  useEffect(() => {
    async function fetchProduit() {
      try {
        const docRef = doc(db, 'produits', params.id as string)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          setProduit({ id: docSnap.id, ...docSnap.data() } as Produit)
          // Fetch chineuse
        const data = docSnap.data()
        let chSnap = null

        // 1. Essayer par trigramme dans la catégorie
        const cat = typeof data.categorie === 'string' ? data.categorie : (data.categorie?.label || '')
        const triMatch = cat.match(/^([A-Z]{2,10})\s*[-–]/)
        if (triMatch) {
          const snap = await getDocs(query(collection(db, 'chineuse'), where('trigramme', '==', triMatch[1])))
          if (!snap.empty) chSnap = snap.docs[0]
        }

        // 2. Fallback par chineurUid
        if (!chSnap && data.chineurUid) {
          const snap = await getDocs(query(collection(db, 'chineuse'), where('authUid', '==', data.chineurUid)))
          if (!snap.empty) chSnap = snap.docs[0]
        }

        // 3. Fallback par email
        if (!chSnap && data.chineur) {
          const snap = await getDocs(query(collection(db, 'chineuse'), where('email', '==', data.chineur)))
          if (!snap.empty) chSnap = snap.docs[0]
        }

        if (chSnap) {
          const ch = chSnap.data()
          setChineuseInfo({ accroche: ch.accroche, description: ch.description, nom: ch.nom, texteEcoCirculaire: ch.texteEcoCirculaire || 1, stockType: ch.stockType })
        }
                }
              } catch (error) {
                console.error('Erreur:', error)
              } finally {
                setLoading(false)
              }
            }

            fetchProduit()
          }, [params.id])

          const handleAjouterPanier = () => {
            if (!produit) return
            const ok = addItem({
              id: produit.id,
              nom: produit.nom,
              prix: produit.prix,
              imageUrl: produit.imageUrls?.[0] || produit.photos?.face || null,
              marque: produit.marque || null,
              sku: (produit as any).sku || null,
            })
            if (ok) {
              setJustAdded(true)
              setTimeout(() => setJustAdded(false), 1500)
            }
          }

          const dansLePanier = produit ? hasItem(produit.id) : false

  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'

  // Vérifier si la catégorie nécessite une taille
  const afficherTaille = (categorie: string) => {
    const catLower = (typeof categorie === 'string' ? categorie : categorie?.label || '').toLowerCase()
    return !categoriesSansTaille.some(cat => catLower.includes(cat))
  }

  if (loading) {
    return (
      <div 
        className="h-screen flex items-center justify-center bg-white"
        style={{ fontFamily: fontHelvetica }}
      >
        <p className="uppercase text-xs tracking-widest" style={{ color: '#999' }}>
          {t('Chargement...', 'Loading...', lang)}
        </p>
      </div>
    )
  }

  if (!produit) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center bg-white"
        style={{ fontFamily: fontHelvetica }}
      >
        <p className="uppercase text-xs tracking-widest mb-6" style={{ color: '#999' }}>
          {t('Produit introuvable', 'Product not found', lang)}
        </p>
        <Link
          href="/boutique"
          className="uppercase text-xs tracking-widest hover:opacity-50 transition"
        >
          {t('← Retour à la boutique', '← Back to shop', lang)}
        </Link>
      </div>
    )
  }

  if (produit.vendu) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center bg-white"
        style={{ fontFamily: fontHelvetica }}
      >
        <p className="uppercase text-xs tracking-widest mb-2" style={{ color: '#999' }}>
          {t('Vendu', 'Sold', lang)}
        </p>
        <p className="text-xs mb-6" style={{ color: '#999' }}>
          {t('Cette pièce a trouvé preneur', 'This piece has found a new home', lang)}
        </p>
        <Link
          href="/boutique"
          className="uppercase text-xs tracking-widest hover:opacity-50 transition"
        >
          {t("← Découvrir d'autres pièces", '← Discover other pieces', lang)}
        </Link>
      </div>
    )
  }

  return (
    <div 
      className="flex flex-col lg:flex-row bg-white"
      style={{ fontFamily: fontHelvetica, minHeight: 'calc(100vh - 80px)' }}
    >
      {/* LEFT: Photos (scroll indépendant) */}
      <div 
        className="w-full lg:w-1/2 lg:h-screen lg:overflow-y-auto lg:sticky lg:top-0"
        style={{ borderRight: '1px solid #000' }}
      >
        {getAllImages(produit).length > 0 ? (
          <>
          <div className="flex flex-col">
            {getAllImages(produit).map((url, index) => (
              <div 
                key={index} 
                className="w-full"
                style={{ borderBottom: index < getAllImages(produit).length - 1 ? '1px solid #000' : 'none' }}
              >
                <img
                  src={url}
                  alt={`${produit.nom} - Photo ${index + 1}`}
                  className="w-full h-auto object-cover"
                />
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
          <div
            className="w-full h-screen flex items-center justify-center"
            style={{ backgroundColor: '#fafafa' }}
          >
            <p className="uppercase text-xs tracking-widest" style={{ color: '#ccc' }}>
              {t('Pas de photo', 'No photo', lang)}
            </p>
          </div>
        )}
      </div>

      {/* RIGHT: Product Info (scroll indépendant) */}
      <div className="w-full lg:w-1/2 lg:h-screen lg:overflow-y-auto">
        <div className="px-6 lg:px-12 py-8 lg:py-12">
          
          {/* === SECTION FIXE : Marque + Nom + Prix + Description === */}
          <div className="pb-8 mb-0">

            {/* Marque - EN GROS */}
            {produit.marque && (
              <h1 
                className="uppercase mb-1"
                style={{ 
                  fontSize: '48px', 
                  letterSpacing: '0.05em', 
                  fontWeight: '700',
                  lineHeight: '1.1'
                }}
              >
                {produit.marque}
              </h1>
            )}

            {/* Nom du produit - plus petit et fin (sans SKU) */}
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: '20px',
                letterSpacing: '0.08em',
                fontWeight: '300',
                color: '#000'
              }}
            >
              {produit.nom.replace(/^[A-Z]{2,10}\d{1,4}\s*[-–]\s*/i, '')}
            </h2>

            {(produit as any).sku && (
              <p style={{
                fontSize: '0.7rem',
                color: '#999',
                marginTop: '-12px',
                marginBottom: '16px',
                letterSpacing: '0.05em',
                fontFamily: 'Helvetica Neue, sans-serif',
              }}>
                {(produit as any).sku}
              </p>
            )}

            {/* Prix */}
            <p
              className="mb-6"
              style={{ fontSize: '16px', letterSpacing: '0.02em' }}
            >
              {produit.prix.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} €
            </p>

            {/* Description - minuscules */}
            {produit.description && (
              <p 
                style={{ 
                  fontSize: '13px', 
                  lineHeight: '1.7', 
                  color: '#333',
                  fontWeight: '300'
                }}
              >
                {produit.description}
              </p>
            )}

            {/* Disclaimer vintage */}
            <p style={{ fontSize: '11px', lineHeight: '1.6', color: '#999', fontWeight: '300', marginTop: '16px' }}>
              {t(
                "Pièce vintage ou upcyclée — peut présenter quelques défauts ou traces d'usure. Vendu en l'état.",
                'Vintage or upcycled item — may show minor imperfections or signs of wear. Sold as is.',
                lang
              )}
            </p>

            {/* === BOUTON AJOUTER AU PANIER === */}
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
                style={{
                  backgroundColor: '#fff',
                  color: '#000',
                  fontSize: '13px',
                  letterSpacing: '0.15em',
                  fontWeight: '400'
                }}
              >
                {t('VOIR LE PANIER', 'VIEW CART', lang)}
              </button>
            )}
          </div>

          {/* === SECTIONS DÉPLIABLES === */}
          
          {/* ÉCONOMIE CIRCULAIRE */}
          <AccordionSection title={t('Économie circulaire et engagement', 'Circular economy & commitment', lang)}>
  <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#1a1a1a', fontWeight: '400' }}>
    {(() => {
      const key = (chineuseInfo?.texteEcoCirculaire || 1) as TexteEcoKey
      const texte = TEXTES_ECO_CIRCULAIRE[key]
      return <p style={{ marginBottom: '16px' }}>{lang === 'en' ? texte.en : texte.fr}</p>
    })()}
    {lang === 'en' ? (
      <p>
        Every brand at NOUVELLE RIVE is committed,{' '}
        <Link href="/nos-creatrices" style={{ color: '#000', textDecoration: 'underline' }}>discover them</Link>.
      </p>
    ) : (
      <p>
        Chaque marque présente chez NOUVELLE RIVE est engagée,{' '}
        <Link href="/nos-creatrices" style={{ color: '#000', textDecoration: 'underline' }}>découvrez-les</Link>.
      </p>
    )}
  </div>
</AccordionSection>

          {/* TAILLE ET CARACTERISTIQUES */}
          {(produit.marque || produit.categorie || produit.taille || produit.material || produit.color || produit.madeIn || produit.composition || produit.etat) && (() => {
            const catRaw = typeof produit.categorie === 'string' ? produit.categorie : (produit.categorie as any)?.label || ''
            const catClean = catRaw.replace(/^[A-Z]{2,5}\s*[-–]\s*/, '').trim()
            return (
              <AccordionSection title={t('Taille et caractéristiques', 'Size & details', lang)} defaultOpen={true}>
                <div style={{ fontSize: '14px', lineHeight: '2', color: '#1a1a1a', fontWeight: '400' }}>
                  {produit.marque && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Marque', 'Brand', lang)}</span>{produit.marque}</p>
                  )}
                  {catClean && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Catégorie', 'Category', lang)}</span>{catClean}</p>
                  )}
                  {produit.material && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Matière', 'Material', lang)}</span>{produit.material}</p>
                  )}
                  {produit.composition && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Composition', 'Composition', lang)}</span>{produit.composition}</p>
                  )}
                  {produit.color && (
                    <p><span style={{ color: '#888', display: 'inline-block', minWidth: '110px' }}>{t('Couleur', 'Color', lang)}</span>{produit.color}</p>
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
            )
          })()}

          {/* À PROPOS DE NOUVELLE RIVE */}
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

          {/* ENTRETIEN */}
          <AccordionSection title={t('Entretien', 'Care', lang)}>
            <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>
              {produit.entretien || t(
                "Nous recommandons un nettoyage à sec pour préserver la qualité de cette pièce. Rangez-la à l'abri de la lumière directe et de l'humidité.",
                'We recommend dry cleaning to preserve the quality of this piece. Store away from direct sunlight and humidity.',
                lang
              )}
            </p>
          </AccordionSection>

          {/* HISTOIRE DE LA MAISON / DÉCOUVRIR LA CHINEUSE selon stockType */}
          {chineuseInfo && (chineuseInfo.accroche || chineuseInfo.description) && (
            <AccordionSection title={chineuseInfo.stockType === 'smallBatch' ? t('Histoire de la maison', 'About the house', lang) : t('Découvrir la chineuse', 'Meet the curator', lang)}>
              {chineuseInfo.nom && (
                  <p style={{ fontSize: '18px', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
                    {chineuseInfo.nom}
                  </p>
                )}
              {chineuseInfo.accroche && (
                <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#333', fontWeight: '400', fontStyle: 'italic', marginBottom: '12px' }}>
                  {chineuseInfo.accroche}
                </p>
              )}
              {chineuseInfo.description && (
                <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>
                  {chineuseInfo.description}
                </p>
              )}
            </AccordionSection>
          )}

          {/* LIVRAISON & RETRAIT */}
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
  )
}