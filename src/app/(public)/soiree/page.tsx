// app/(public)/soiree/page.tsx
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

export default function SoireePage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSoireeProduits() {
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

        // Filtrage SOIRÉE :
        // 1. catégorie contient "robe" ET description contient "soie", "satin", ou "sequin"
        // 2. description contient "blazer"
        // 3. catégorie contient "chaussures" ET description contient "talons", "escarpins", "Chanel", "Dior", "Prada", ou "Yves Saint Laurent"
        
        data = data.filter(p => {
          const categorieLower = (p.categorie || '').toLowerCase()
          const descriptionLower = (p.description || '').toLowerCase()
          
          // Condition 1 : Robe + matière luxe
          const isRobe = categorieLower.includes('robe')
          const hasLuxFabric = 
            descriptionLower.includes('soie') ||
            descriptionLower.includes('satin') ||
            descriptionLower.includes('sequin')
          const condition1 = isRobe && hasLuxFabric
          
          // Condition 2 : Blazer
          const condition2 = descriptionLower.includes('blazer')
          
          // Condition 3 : Chaussures + talons/marques
          const isChaussures = categorieLower.includes('chaussures')
          const hasShoesKeywords = 
            descriptionLower.includes('talons') ||
            descriptionLower.includes('escarpins') ||
            descriptionLower.includes('chanel') ||
            descriptionLower.includes('dior') ||
            descriptionLower.includes('prada') ||
            descriptionLower.includes('yves saint laurent')
          const condition3 = isChaussures && hasShoesKeywords
          
          return condition1 || condition2 || condition3
        })

        setProduits(data)
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSoireeProduits()
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