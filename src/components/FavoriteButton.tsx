// src/components/FavoriteButton.tsx
'use client'

import { useState, useEffect } from 'react'
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/lib/firebaseConfig'

type Props = {
  productId: string
  className?: string
  size?: number
}

export default function FavoriteButton({ productId, className = '', size = 24 }: Props) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const bleuElectrique = '#0000FF'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid)
        // Vérifier si le produit est déjà en favoris
        const docRef = doc(db, 'favoris', `${user.uid}_${productId}`)
        const docSnap = await getDoc(docRef)
        setIsFavorite(docSnap.exists())
      } else {
        setUserId(null)
        setIsFavorite(false)
      }
    })

    return () => unsubscribe()
  }, [productId])

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault() // Empêcher la navigation si dans un Link
    e.stopPropagation()

    if (!userId) {
      alert('Veuillez vous connecter pour ajouter aux favoris')
      return
    }

    setLoading(true)

    try {
      const docRef = doc(db, 'favoris', `${userId}_${productId}`)

      if (isFavorite) {
        // Retirer des favoris
        await deleteDoc(docRef)
        setIsFavorite(false)
      } else {
        // Ajouter aux favoris
        await setDoc(docRef, {
          userId,
          productId,
          dateAjout: new Date().toISOString()
        })
        setIsFavorite(true)
      }
    } catch (error) {
      console.error('Erreur favoris:', error)
    } finally {
      setLoading(false)
    }
  }
  
return (
  <button
    onClick={toggleFavorite}
    disabled={loading}
    className={`transition-all duration-200 hover:scale-110 ${isFavorite ? 'is-favorite' : ''} ${className}`}
    title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
  >
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFavorite ? bleuElectrique : 'none'}
      stroke={bleuElectrique}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.2))',
      }}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  </button>
)
}
