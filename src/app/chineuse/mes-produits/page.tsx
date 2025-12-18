// app/chineuse/mes-produits/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore'
import ProductList, { Produit } from '@/components/ProductList'

export default function MesProduits() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state:', user?.email || 'non connecté')

      if (!user?.email) {
        setLoading(false)
        return
      }

      console.log('Email connecté:', user.email)

      // Récupérer le trigramme de l'utilisateur
      const chineuseSnap = await getDocs(
        query(collection(db, 'chineuse'), where('email', '==', user.email))
      )
      let trigramme = ''
      if (!chineuseSnap.empty) {
        trigramme = chineuseSnap.docs[0].data().trigramme || ''
      }

      // Filtrer par trigramme si disponible, sinon par email
      const q = trigramme
        ? query(collection(db, 'produits'), where('trigramme', '==', trigramme))
        : query(collection(db, 'produits'), where('chineur', '==', user.email))

      const unsubProduits = onSnapshot(q, (snap) => {
        console.log('Produits trouvés:', snap.docs.length)
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Produit))
        setProduits(data)
        setLoading(false)
      })

      return () => unsubProduits()
    })

    return () => unsubAuth()
  }, [])

  return (
    <ProductList
      titre="MES PRODUITS CHEZ NOUVELLE RIVE"
      produits={produits}
      isAdmin={false}
      loading={loading}
    />
  )
}