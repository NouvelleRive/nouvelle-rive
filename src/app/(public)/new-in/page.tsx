// app/(public)/new-in/page.tsx
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

export default function NewInPage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNewProduits() {
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

        // Trier par date en JavaScript (après récupération)
        data = data
          .filter(p => p.createdAt) // Garde seulement ceux qui ont une date
          .sort((a, b) => {
            const dateA = a.createdAt?.toMillis?.() || 0
            const dateB = b.createdAt?.toMillis?.() || 0
            return dateB - dateA // Plus récent en premier
          })
          .slice(0, 20) // Garde les 20 premiers

        setProduits(data)
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchNewProduits()
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