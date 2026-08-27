// app/acheteuse/mes-produits/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import ProductList, { Produit } from '@/components/ProductList'
import { ACHETEUSE_TRIGRAMME, ACHETEUSE_EMAIL, ACHETEUSE_CHINEUSE_DOC } from '@/lib/roles'

export default function AcheteuseMesProduits() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user?.email) { setLoading(false); return }
      const q = query(collection(db, 'produits'), where('trigramme', '==', ACHETEUSE_TRIGRAMME))
      const unsubProduits = onSnapshot(q, (snap) => {
        setProduits(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Produit)))
        setLoading(false)
      })
      return () => unsubProduits()
    })
    return () => unsubAuth()
  }, [])

  return (
    <ProductList
      titre="MES ACHATS"
      produits={produits}
      isAdmin={false}
      isAcheteuse={true}
      targetChineuse={{ uid: ACHETEUSE_CHINEUSE_DOC, email: ACHETEUSE_EMAIL, trigramme: ACHETEUSE_TRIGRAMME }}
      loading={loading}
    />
  )
}
