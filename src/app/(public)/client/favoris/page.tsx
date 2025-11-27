// app/client/favoris/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/lib/firebaseConfig'
import FavoriteButton from '@/components/FavoriteButton'

type Produit = {
  id: string
  nom: string
  prix: number
  imageUrls: string[]
  marque?: string
  vendu: boolean
}

export default function FavorisPage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleuElectrique = '#0000FF'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/client/login')
        return
      }

      try {
        // Récupérer les favoris de l'utilisateur
        const q = query(
          collection(db, 'favoris'),
          where('userId', '==', currentUser.uid)
        )
        const snapshot = await getDocs(q)
        
        // Récupérer les détails de chaque produit
        const produitsPromises = snapshot.docs.map(async (favorisDoc) => {
          const productId = favorisDoc.data().productId
          const produitDoc = await getDoc(doc(db, 'produits', productId))
          
          if (produitDoc.exists()) {
            return { id: produitDoc.id, ...produitDoc.data() } as Produit
          }
          return null
        })

        const produitsData = await Promise.all(produitsPromises)
        setProduits(produitsData.filter(p => p !== null) as Produit[])
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: fontHelvetica }}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/client" className="text-sm hover:underline mb-4 inline-block">
            ← Retour à mon compte
          </Link>
          
          <h1 
            className="uppercase mb-2"
            style={{ 
              fontSize: '48px',
              fontWeight: '700',
              letterSpacing: '-0.01em',
              lineHeight: '1'
            }}
          >
            MES FAVORIS
          </h1>
          
          <p className="text-gray-600">
            {produits.length} {produits.length > 1 ? 'pièces' : 'pièce'} en favori
          </p>
        </div>

        <div style={{ borderBottom: '1px solid #000' }} className="mb-8" />

        {produits.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl mb-2">💙</p>
            <p className="text-gray-600 mb-4">Vous n'avez pas encore de favoris</p>
            <Link
              href="/boutique"
              className="inline-block px-6 py-3 transition-all hover:opacity-80"
              style={{ 
                backgroundColor: bleuElectrique,
                color: 'white',
                fontSize: '11px',
                letterSpacing: '0.2em',
                fontWeight: '600'
              }}
            >
              DÉCOUVRIR LA BOUTIQUE
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {produits.map((produit) => (
              <div key={produit.id} className="relative group">
                <Link href={`/produit/${produit.id}`}>
                  <div className="aspect-square overflow-hidden bg-gray-100 mb-3">
                    {produit.imageUrls?.[0] ? (
                      <img
                        src={produit.imageUrls[0]}
                        alt={produit.nom}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        Pas d'image
                      </div>
                    )}
                  </div>

                  {produit.vendu && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white px-3 py-1 text-xs font-semibold">
                      VENDU
                    </div>
                  )}

                  {produit.marque && (
                    <p 
                      className="uppercase mb-1"
                      style={{ 
                        fontSize: '10px',
                        letterSpacing: '0.2em',
                        color: '#999'
                      }}
                    >
                      {produit.marque}
                    </p>
                  )}

                  <h3 className="font-medium mb-2 line-clamp-2">{produit.nom}</h3>
                  <p className="text-lg font-bold">{produit.prix.toFixed(2)} €</p>
                </Link>

                {/* Bouton Favori */}
                <div className="absolute top-2 right-2">
                  <FavoriteButton productId={produit.id} size={20} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}