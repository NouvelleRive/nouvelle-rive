// app/vendeuse/produits/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/firebaseConfig'
import { collection, query, onSnapshot, orderBy, limit, where, Timestamp } from 'firebase/firestore'
import ProductList, { Produit, Deposant } from '@/components/ProductList'

export default function VendeuseProduits() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Charger les déposants au démarrage (léger)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'chineuse'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deposant))
      setDeposants(data)
    })
    return () => unsub()
  }, [])

  // Fonction pour charger les produits (appelée par le bouton Chercher)
  const loadProduits = useCallback(() => {
    setLoading(true)
    setHasSearched(true)
    
    const unsub = onSnapshot(collection(db, 'produits'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Produit))
      setProduits(data)
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <ProductList
        titre="Tous les produits"
        produits={produits}
        deposants={deposants}
        isAdmin={false}
        loading={loading}
        onSearch={loadProduits}
        showSearchButton={!hasSearched}
      />
    </div>
  )
}