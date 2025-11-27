// app/(public)/hiver/page.tsx
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
  description: string
  marque?: string
  taille?: string
  vendu: boolean
  promotion?: boolean
  createdAt?: any
}

export default function HiverPage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHiverProduits() {
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

        // Filtrage HIVER :
        // - catégorie contient "Pull" ou "Manteaux"
        // - description contient "fourrure", "fur", "col roulé", ou "turtle neck"
        data = data.filter(p => {
          const categorieLower = (p.categorie || '').toLowerCase()
          const descriptionLower = (p.description || '').toLowerCase()
          
          const isPullOrManteau = categorieLower.includes('pull') || categorieLower.includes('manteaux')
          
          const hasWinterKeywords = 
            descriptionLower.includes('fourrure') ||
            descriptionLower.includes('fur') ||
            descriptionLower.includes('col roulé') ||
            descriptionLower.includes('turtle neck')
          
          return isPullOrManteau || hasWinterKeywords
        })

        setProduits(data)
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHiverProduits()
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