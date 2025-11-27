// app/(public)/femme/page.tsx
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
  chineur: string
  promotion?: boolean
  createdAt?: any
}

export default function FemmePage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  // Chineurs à EXCLURE (Homme + Enfant + Accessoires)
  const CHINEURS_EXCLUS = [
    'SERGIO TACCHINEUR',
    'DARK VINTAGE',
    'MISSION VINTAGE',
    'CENT NEUF',
    'BONAGE',
    'INES PINEAU',
    'TETE D\'ORANGE',
    'MAKI',
    'ARCHIVES'
  ]

  useEffect(() => {
    async function fetchFemmeProduits() {
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

        // Filtrer : garde tout SAUF les chineurs exclus
        data = data.filter(p => !CHINEURS_EXCLUS.includes(p.chineur))

        setProduits(data)
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFemmeProduits()
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