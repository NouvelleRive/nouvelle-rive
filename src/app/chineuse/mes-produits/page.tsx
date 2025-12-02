// app/chineuse/mes-produits/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import ProductList, { Produit } from '@/components/ProductList'

export default function MesProduits() {
  const { user } = useAuth()
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.email) return

    const q = query(
      collection(db, 'produits'),
      where('chineur', '==', user.email)
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Produit))
      setProduits(data)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user?.email])

  return (
    <ProductList
      titre="MES PRODUITS CHEZ NOUVELLE RIVE"
      produits={produits}
      isAdmin={false}
      loading={loading}
    />
  )
}