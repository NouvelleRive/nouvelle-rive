// app/(public)/le-luxe/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import ProductGrid from '@/components/ProductGrid'

type Produit = {
  id: string
  nom: string
  prix: number
  imageUrls: string[]
  categorie: string
  marque?: string
  taille?: string
  vendu: boolean
  promotion?: boolean
  createdAt?: any
}

// Liste des marques de luxe (insensible à la casse)
const MARQUES_LUXE = [
  'chanel',
  'dior',
  'yves saint laurent',
  'saint laurent',
  'ysl',
  'prada',
  'gucci',
  'versace',
  'rick owens',
  'rickowens',
  'burberrys',
  'burberry',
  'fendi',
  'hermes',
  'céline',
  'celine',
  'givenchy',
  'balenciaga',
  'valentino',
  'margiela',
  'maison margiela',
  'loewe',
  'bottega veneta',
  'alexander mcqueen',
  'stella mccartney'
]

export default function LeLuxePage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLuxeProduits() {
      try {
        const q = query(
          collection(db, 'produits'),
          where('vendu', '==', false)
        )
        
        const snapshot = await getDocs(q)
        let data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Produit[]

        // Filtrer : prix > 500€ OU marque de luxe
        data = data.filter(p => {
          const isPriceHigh = p.prix > 500
          const isLuxuryBrand = p.marque && MARQUES_LUXE.includes(p.marque.toLowerCase().trim())
          return isPriceHigh || isLuxuryBrand
        })

        // Trier par prix décroissant (plus cher en premier)
        data.sort((a, b) => b.prix - a.prix)

        setProduits(data)
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLuxeProduits()
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
      <ProductGrid produits={produits} columns={3} />
    </div>
  )
}