// app/chineuse/mes-produits/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import ProductList, { Produit } from '@/components/ProductList'

export default function MesProduits() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user?.email) {
        console.log('Email connecté:', user.email)
        setLoading(false)
        return
      }

      const q = query(
        collection(db, 'produits'),
        where('chineur', '==', user.email)
      )

      const unsubProduits = onSnapshot(q, (snap) => {
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