// app/admin/nos-produits/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/lib/firebaseConfig'
import { collection, onSnapshot } from 'firebase/firestore'
import ProductList, { Produit, Deposant } from '@/components/ProductList'
import { useAdmin } from '@/lib/admin/context'

export default function NosProduits() {
  const { selectedChineuse } = useAdmin()
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

  // Filtrer les produits selon la chineuse sélectionnée
  const produitsFiltres = useMemo(() => {
    if (!selectedChineuse) return produits
    return produits.filter(p => 
      p.chineur === selectedChineuse.email || 
      p.chineurUid === selectedChineuse.uid
    )
  }, [produits, selectedChineuse])

  // Titre dynamique
  const titre = selectedChineuse 
    ? `PRODUITS DE ${(selectedChineuse.nom || selectedChineuse.email?.split('@')[0] || '').toUpperCase()}`
    : "TOUS LES PRODUITS"

  return (
    <ProductList
      titre={titre}
      produits={produitsFiltres}
      deposants={deposants}
      isAdmin={true}
      loading={loading}
    />
  )
}