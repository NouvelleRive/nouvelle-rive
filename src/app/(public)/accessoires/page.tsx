// app/(public)/accessoires/page.tsx
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

export default function AccessoiresPage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  const CHINEURS_ACCESSOIRES = [
    'INES PINEAU',
    'TETE D\'ORANGE',
    'MAKI',
    'ARCHIVES'
  ]

  useEffect(() => {
    async function fetchAccessoiresProduits() {
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

        // Filtrer : garde uniquement les chineurs accessoires
        data = data.filter(p => CHINEURS_ACCESSOIRES.includes(p.chineur))

        setProduits(data)
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAccessoiresProduits()
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