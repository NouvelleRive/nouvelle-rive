// app/admin/nos-produits/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebaseConfig'
import { collection, onSnapshot } from 'firebase/firestore'
import ProductList, { Produit, Deposant } from '@/components/ProductList'

export default function NosProduits() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Charger tous les produits
    const unsubProduits = onSnapshot(collection(db, 'produits'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Produit))
      setProduits(data)
      setLoading(false)
    })

    // Charger les déposants/chineuses
    const unsubDeposants = onSnapshot(collection(db, 'chineuses'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deposant))
      setDeposants(data)
    })

    return () => {
      unsubProduits()
      unsubDeposants()
    }
  }, [])

  return (
    <ProductList
      titre="TOUS LES PRODUITS"
      produits={produits}
      deposants={deposants}
      isAdmin={true}
      loading={loading}
    />
  )
}