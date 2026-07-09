// app/admin/nos-produits/page.tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { auth } from '@/lib/firebaseConfig'
import ProductList, { Produit, Deposant } from '@/components/ProductList'
import { useAdmin } from '@/lib/admin/context'

export default function NosProduits() {
  const { selectedChineuse } = useAdmin()
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [loading, setLoading] = useState(true)

  // Callback pour mise à jour immédiate après modification
  const handleProductUpdated = useCallback((productId: string, updatedData: Partial<Produit>) => {
    setProduits(prev => prev.map(p =>
      p.id === productId ? { ...p, ...updatedData } : p
    ))
  }, [])

  // Fetch one-shot via route API cachée (au lieu d'onSnapshot sur toute la
  // collection produits — évite 1500 reads par montage). La push notif à la
  // vente prévient déjà la propriétaire d'un changement ; sinon elle refresh.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = await auth.currentUser?.getIdToken()
        const [prodRes, chRes] = await Promise.all([
          fetch('/api/admin/produits-full', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }),
          fetch('/api/chineuses-lite'),
        ])
        const prodData = prodRes.ok ? await prodRes.json() : { produits: [] }
        const chList = chRes.ok ? await chRes.json() : []
        if (cancelled) return
        setProduits(Array.isArray(prodData.produits) ? prodData.produits : [])
        setDeposants(Array.isArray(chList) ? chList : [])
      } catch (err) {
        console.error('[admin/nos-produits] load failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Filtrer les produits selon la chineuse sélectionnée
  const produitsFiltres = useMemo(() => {
    if (!selectedChineuse) return produits
    return produits.filter(p => 
      p.chineur === selectedChineuse.email || 
      p.chineurUid === selectedChineuse.uid ||
      (selectedChineuse.trigramme && p.trigramme === selectedChineuse.trigramme)
    )
  }, [produits, selectedChineuse])

  // Titre dynamique
  const titre = selectedChineuse 
    ? `PRODUITS DE ${(selectedChineuse.nom || selectedChineuse.email?.split('@')[0] || '').toUpperCase()}`
    : "TOUS LES PRODUITS"

  // La chineuse cible pour l'import est la chineuse sélectionnée. La règle
  // d'affichage des boutons est gérée par ProductList :
  //   - NR        → Vinted + Whatnot
  //   - smallBatch → rien
  //   - autre (pièce unique) → Vinted seul
  const targetChineuse = selectedChineuse
    ? {
        uid: selectedChineuse.uid,
        email: selectedChineuse.email,
        trigramme: selectedChineuse.trigramme,
        stockType: (selectedChineuse as any).stockType,
      }
    : undefined

  return (
    <ProductList
      titre={titre}
      produits={produitsFiltres}
      deposants={deposants}
      isAdmin={true}
      loading={loading}
      onProductUpdated={handleProductUpdated}
      targetChineuse={targetChineuse}
    />
  )
}