// src/app/(public)/boutique/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import Link from 'next/link'

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
  etat?: string
  composition?: string
  entretien?: string
  vendu: boolean
}

// Catégories qui n'ont pas de taille
const categoriesSansTaille = ['bijoux', 'boucles d\'oreilles', 'colliers', 'bracelets', 'bagues', 'lunettes', 'lunettes de soleil', 'montres', 'accessoires']

function getAllImages(p: Produit): string[] {
  // Priorité à imageUrls (respecte l'ordre défini)
  if (p.imageUrls?.length > 0) return p.imageUrls
  
  // Fallback sur photos structurées
  const imgs: string[] = []
  if (p.photos) {
    if (p.photos.face) imgs.push(p.photos.face)
    if (p.photos.faceOnModel) imgs.push(p.photos.faceOnModel)
    if (p.photos.dos) imgs.push(p.photos.dos)
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
  const [chineuseInfo, setChineuseInfo] = useState<{accroche?: string, description?: string, nom?: string} | null>(null)

  useEffect(() => {
    async function fetchProduit() {
      try {
        const docRef = doc(db, 'produits', params.id as string)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          setProduit({ id: docSnap.id, ...docSnap.data() } as Produit)
          // Fetch chineuse
          const data = docSnap.data()
          const cat = data.categorie || ''
          const triMatch = cat.match(/^([A-Z]{2,10})\s*[-–]/)
          if (triMatch) {
            const tri = triMatch[1]
            const q = query(collection(db, 'chineuse'), where('trigramme', '==', tri))
            const snap = await getDocs(q)
            if (!snap.empty) {
              const ch = snap.docs[0].data()
              setChineuseInfo({ accroche: ch.accroche, description: ch.description, nom: ch.nom })
            }
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

  const handleAcheter = () => {
    if (produit) {
      router.push(`/checkout?productId=${produit.id}`)
    }
  }

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
          Chargement...
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
          Produit introuvable
        </p>
        <Link 
          href="/boutique" 
          className="uppercase text-xs tracking-widest hover:opacity-50 transition"
        >
          ← Retour à la boutique
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
          Vendu
        </p>
        <p className="text-xs mb-6" style={{ color: '#999' }}>
          Cette pièce a trouvé preneur
        </p>
        <Link 
          href="/boutique" 
          className="uppercase text-xs tracking-widest hover:opacity-50 transition"
        >
          ← Découvrir d'autres pièces
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
        ) : (
          <div 
            className="w-full h-screen flex items-center justify-center"
            style={{ backgroundColor: '#fafafa' }}
          >
            <p className="uppercase text-xs tracking-widest" style={{ color: '#ccc' }}>
              Pas de photo
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

            {/* Prix */}
            <p 
              className="mb-6"
              style={{ fontSize: '16px', letterSpacing: '0.02em' }}
            >
              {produit.prix.toLocaleString('fr-FR')} €
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

            {/* === BOUTON ACHETER === */}
          <div className="mt-8 mb-6">
            <button
              onClick={handleAcheter}
              className="w-full py-4 uppercase transition hover:opacity-80"
              style={{ 
                backgroundColor: '#000',
                color: '#fff',
                fontSize: '13px',
                letterSpacing: '0.15em',
                fontWeight: '400'
              }}
            >
              Acheter
            </button>
          </div>

          {/* === SECTIONS DÉPLIABLES === */}
          
          {/* ÉCONOMIE CIRCULAIRE */}
          <AccordionSection title="Économie circulaire">
            <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>
              En choisissant une pièce de seconde main, vous participez activement à l'économie circulaire. 
              Chaque vêtement qui trouve une nouvelle vie, c'est une production évitée, des ressources 
              préservées et une empreinte carbone réduite. La mode vintage et seconde main représente 
              une alternative responsable qui ne sacrifie ni le style ni la qualité. Chez Nouvelle Rive, 
              nous croyons que le luxe de demain passe par la réutilisation des pièces d'exception d'hier.
            </p>
          </AccordionSection>

          {/* TAILLE - seulement si pertinent */}
          {afficherTaille(produit.categorie) && produit.taille && (
            <AccordionSection title="Taille">
              <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>
                {produit.taille}
              </p>
            </AccordionSection>
          )}

          {/* ENTRETIEN */}
          <AccordionSection title="Entretien">
            <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>
              {produit.entretien || 'Nous recommandons un nettoyage à sec pour préserver la qualité de cette pièce. Rangez-la à l\'abri de la lumière directe et de l\'humidité.'}
            </p>
          </AccordionSection>

          {/* HISTOIRE DE LA MAISON */}
          {produit.marque && (
            <AccordionSection title="Histoire de la maison">
              <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#666', fontWeight: '300' }}>
                {/* TODO: Récupérer l'histoire de la marque depuis une collection Firebase */}
                {produit.marque} est une maison emblématique de la mode. Son histoire riche et son 
                savoir-faire unique en font une référence incontournable dans l'univers du luxe. 
                Chaque pièce témoigne d'un héritage artisanal et d'une vision créative singulière.
              </p>
            </AccordionSection>
          )}

          {/* LIVRAISON & RETRAIT */}
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