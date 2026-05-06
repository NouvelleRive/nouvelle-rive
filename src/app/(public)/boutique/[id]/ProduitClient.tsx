'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TEXTES_ECO_CIRCULAIRE, TexteEcoKey } from '@/lib/textesEcoCirculaire'

type Produit = {
  id: string
  nom: string
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
  taille?: string
  color?: string
  material?: string
  madeIn?: string
  entretien?: string
  vendu: boolean
}

type ChineuseInfo = {
  accroche?: string
  description?: string
  nom?: string
  texteEcoCirculaire?: number
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
        <span className="uppercase" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '13px', letterSpacing: '0.05em', fontWeight: '400' }}>{title}</span>
        <span className="transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '20px', fontWeight: '300' }}>∨</span>
      </button>
      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isOpen ? '500px' : '0', opacity: isOpen ? 1 : 0 }}>
        <div className="pb-6">{children}</div>
      </div>
    </div>
  )
}

export default function ProduitClient({ produit, chineuseInfo }: { produit: Produit; chineuseInfo: ChineuseInfo | null }) {
  const router = useRouter()
  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'

  const afficherTaille = (categorie: any) => {
    const catLower = (typeof categorie === 'string' ? categorie : categorie?.label || '').toLowerCase()
    return !categoriesSansTaille.some(cat => catLower.includes(cat))
  }

  const allImages = getAllImages(produit)

  return (
    <div className="flex flex-col lg:flex-row bg-white" style={{ fontFamily: fontHelvetica, minHeight: 'calc(100vh - 80px)' }}>
      {/* LEFT: Photos */}
      <div className="w-full lg:w-1/2 lg:h-screen lg:overflow-y-auto lg:sticky lg:top-0" style={{ borderRight: '1px solid #000' }}>
        {allImages.length > 0 ? (
          <>
            <div className="flex flex-col">
              {allImages.map((url, index) => (
                <div key={index} className="w-full" style={{ borderBottom: index < allImages.length - 1 ? '1px solid #000' : 'none' }}>
                  <img src={url} alt={`${produit.nom} - Photo ${index + 1}`} className="w-full h-auto object-cover" />
                </div>
              ))}
            </div>
            {produit.photos?.faceOnModel && (
              <p style={{ fontSize: '10px', color: '#999', fontWeight: '300', padding: '8px 12px', textAlign: 'center', borderTop: '1px solid #000' }}>
                Photo d'illustration générée par intelligence artificielle. Non contractuelle.<br />
                <span style={{ fontStyle: 'italic' }}>AI-generated illustrative photo. For reference only.</span>
              </p>
            )}
          </>
        ) : (
          <div className="w-full h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}>
            <p className="uppercase text-xs tracking-widest" style={{ color: '#ccc' }}>Pas de photo</p>
          </div>
        )}
      </div>

      {/* RIGHT: Product Info */}
      <div className="w-full lg:w-1/2 lg:h-screen lg:overflow-y-auto">
        <div className="px-6 lg:px-12 py-8 lg:py-12">
          <div className="pb-8 mb-0">
            {produit.marque && (
              <h1 className="uppercase mb-1" style={{ fontSize: '48px', letterSpacing: '0.05em', fontWeight: '700', lineHeight: '1.1' }}>
                {produit.marque}
              </h1>
            )}
            <h2 className="uppercase mb-4" style={{ fontSize: '20px', letterSpacing: '0.08em', fontWeight: '300', color: '#000' }}>
              {produit.nom.replace(/^[A-Z]{2,10}\d{1,4}\s*[-–]\s*/i, '')}
            </h2>
            {produit.sku && (
              <p style={{ fontSize: '0.7rem', color: '#999', marginTop: '-12px', marginBottom: '16px', letterSpacing: '0.05em' }}>
                {produit.sku}
              </p>
            )}
            <p className="mb-6" style={{ fontSize: '16px', letterSpacing: '0.02em' }}>{produit.prix.toLocaleString('fr-FR')} €</p>
            {produit.description && (
              <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#333', fontWeight: '300' }}>{produit.description}</p>
            )}
            <p style={{ fontSize: '11px', lineHeight: '1.6', color: '#999', fontWeight: '300', marginTop: '16px' }}>
              Pièce vintage ou upcyclée — peut présenter quelques défauts ou traces d'usure. Vendu en l'état.<br />
              <span style={{ fontStyle: 'italic' }}>Vintage or upcycled item — may show minor imperfections or signs of wear. Sold as is.</span>
            </p>

            <div className="mt-8 mb-6">
              <button
                onClick={() => router.push(`/checkout?productId=${produit.id}`)}
                className="w-full py-4 uppercase transition hover:opacity-80"
                style={{ backgroundColor: '#000', color: '#fff', fontSize: '13px', letterSpacing: '0.15em', fontWeight: '400' }}
              >
                Acheter
              </button>
            </div>

            <AccordionSection title="Économie circulaire et engagement">
              <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>
                {(() => {
                  const key = (chineuseInfo?.texteEcoCirculaire || 1) as TexteEcoKey
                  const texte = TEXTES_ECO_CIRCULAIRE[key]
                  return (
                    <>
                      <p style={{ marginBottom: '16px' }}>{texte.fr}</p>
                      <p style={{ marginBottom: '16px', color: '#999', fontStyle: 'italic' }}>{texte.en}</p>
                    </>
                  )
                })()}
                <p>Chaque marque présente chez NOUVELLE RIVE est engagée,{' '}<Link href="/creatrices" style={{ color: '#000', textDecoration: 'underline' }}>découvrez-les</Link>.</p>
                <p style={{ color: '#999', fontStyle: 'italic', marginTop: '4px' }}>Every brand at NOUVELLE RIVE is committed,{' '}<Link href="/creatrices" style={{ color: '#999', textDecoration: 'underline' }}>discover them</Link>.</p>
              </div>
            </AccordionSection>

            {(produit.taille || produit.material || produit.color || produit.madeIn) && (
              <AccordionSection title="Taille et caractéristiques" defaultOpen={true}>
                <div style={{ fontSize: '13px', lineHeight: '2', color: '#666', fontWeight: '300' }}>
                  {afficherTaille(produit.categorie) && produit.taille && <p><span style={{ color: '#999' }}>Taille :</span> {produit.taille}</p>}
                  {produit.material && <p><span style={{ color: '#999' }}>Matière :</span> {produit.material}</p>}
                  {produit.color && <p><span style={{ color: '#999' }}>Couleur :</span> {produit.color}</p>}
                  {produit.madeIn && <p><span style={{ color: '#999' }}>Origine :</span> {produit.madeIn}</p>}
                </div>
              </AccordionSection>
            )}

            <AccordionSection title="Entretien">
              <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>
                {produit.entretien || "Nous recommandons un nettoyage à sec pour préserver la qualité de cette pièce. Rangez-la à l'abri de la lumière directe et de l'humidité."}
              </p>
            </AccordionSection>

            {chineuseInfo && (chineuseInfo.accroche || chineuseInfo.description) && (
              <AccordionSection title="Histoire de la maison">
                {chineuseInfo.nom && <p style={{ fontSize: '18px', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>{chineuseInfo.nom}</p>}
                {chineuseInfo.accroche && <p style={{ fontSize: '14px', lineHeight: '1.7', color: '#333', fontWeight: '400', fontStyle: 'italic', marginBottom: '12px' }}>{chineuseInfo.accroche}</p>}
                {chineuseInfo.description && <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>{chineuseInfo.description}</p>}
              </AccordionSection>
            )}

            <AccordionSection title="Livraison & retrait">
              <div style={{ fontSize: '13px', lineHeight: '2', color: '#666', fontWeight: '300' }}>
                <p>• Retrait gratuit en boutique — 8 rue des Ecouffes, 75004 Paris</p>
                <p>• Livraison Colissimo — 15€ (offerte dès le 2e achat de la journée)</p>
                <p>• Expédition sous 48h ouvrées</p>
                <p>• Paiement sécurisé par carte bancaire</p>
              </div>
            </AccordionSection>
          </div>
        </div>
      </div>
    </div>
  )
}