// app/boutique/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import ProductGrid from '@/components/ProductGrid'
import CountdownPromo from '@/components/CountdownPromo'

type Produit = {
  id: string
  nom: string
  prix: number
  imageUrls: string[]
  categorie: string
  marque?: string
  vendu: boolean
  promotion?: boolean
  createdAt?: any
  photos?: {
    face?: string
    faceOnModel?: string
    dos?: string
    details?: string[]
  }
  forceDisplay?: boolean
}

export default function BoutiquePage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)
  const [nombreAchats, setNombreAchats] = useState(0)

  useEffect(() => {
    // Récupérer le nombre d'achats du jour
    const achats = localStorage.getItem('nouvelle-rive-achats')
    setNombreAchats(achats ? parseInt(achats) : 0)

    async function fetchProduits() {
      try {
        const q = query(
          collection(db, 'produits'),
          where('vendu', '==', false)
        )
        
        const snapshot = await getDocs(q)
        const data = snapshot.docs.map(doc => {
          const d = doc.data()
          // Prioriser photos.face (détourée) sur imageUrls
          const imageUrls = d.photos?.face 
            ? [d.photos.face, ...(d.imageUrls || [])]
            : d.imageUrls || []
          return {
            id: doc.id,
            ...d,
            imageUrls
          }
        }) as Produit[]

        // Filtrer : seulement les produits avec photo détourée OU tryon OU forcé
        const produitsVisibles = data.filter(p => {
          // Forçage manuel
          if (p.forceDisplay === true) return true
          
          // Photo détourée (face traitée sur Cloudinary)
          if (p.photos?.face) return true
          
          // Photo portée (tryon Replicate)
          if (p.photos?.faceOnModel) return true
          
          return false
        })

        setProduits(produitsVisibles)
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProduits()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Grille produits */}
      <ProductGrid produits={produits} columns={3} />

      {/* Countdown promo (flottant en bas) */}
      <CountdownPromo nombreAchats={nombreAchats} />

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="text-center text-gray-600 text-sm">
          <p>© 2025 Nouvelle Rive • 8 rue des Ecouffes, Paris</p>
        </div>
      </footer>
    </div>
  )
}