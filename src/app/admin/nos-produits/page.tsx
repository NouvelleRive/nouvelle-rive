// app/admin/nos-produits/page.tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { auth } from '@/lib/firebaseConfig'
import ProductList, { Produit, Deposant } from '@/components/ProductList'
import { useAdmin } from '@/lib/admin/context'
import { rehydrateTimestamps } from '@/lib/rehydrateTimestamps'

export default function NosProduits() {
  const { selectedChineuse } = useAdmin()
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [loading, setLoading] = useState(true)
  const [forcingBlob, setForcingBlob] = useState(false)

  const handleForceBlob = async () => {
    if (!confirm('Forcer le rafraîchissement du cache produits ?\n(rescan complet Firestore — à utiliser ponctuellement)')) return
    setForcingBlob(true)
    try {
      const res = await fetch('/api/cache/refresh-produits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      const data = await res.json()
      if (data?.success) alert(`✅ Cache régénéré (${data.count} produits)`)
      else alert('❌ Échec du rafraîchissement')
    } catch {
      alert('❌ Échec du rafraîchissement')
    } finally {
      setForcingBlob(false)
    }
  }

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
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const [prodRes, chRes] = await Promise.all([
          // no-store : la réponse porte un `max-age=300`, sans ça le navigateur
          // resservait une liste vieille de 5 min après une modification de fiche.
          // Le cache serveur (blob) reste en place — 0 read Firestore de plus.
          fetch('/api/admin/produits-full', { headers, cache: 'no-store' }),
          fetch('/api/admin/chineuses-full', { headers }),
        ])
        const prodData = prodRes.ok ? await prodRes.json() : { produits: [] }
        const chData = chRes.ok ? await chRes.json() : { chineuses: [] }
        if (cancelled) return
        // rehydrateTimestamps : NextResponse.json sérialise les Timestamps admin
        // en { _seconds, _nanoseconds } — on les reconvertit en Timestamp SDK
        // client pour que ProductList (`.toDate()`, `instanceof Timestamp`) marche.
        setProduits(rehydrateTimestamps(Array.isArray(prodData.produits) ? prodData.produits : []))
        const chList = Array.isArray(chData.chineuses) ? chData.chineuses : []
        setDeposants(chList.map((c: any) => ({ id: c.uid, ...c })))
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
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={handleForceBlob}
          disabled={forcingBlob}
          className="text-sm px-4 py-2 rounded-lg border border-[#22209C] text-[#22209C] hover:bg-[#22209C] hover:text-white transition disabled:opacity-50"
        >
          {forcingBlob ? 'Rafraîchissement…' : '🔄 Forcer le cache produits'}
        </button>
      </div>
      <ProductList
        titre={titre}
        produits={produitsFiltres}
        deposants={deposants}
        isAdmin={true}
        loading={loading}
        onProductUpdated={handleProductUpdated}
        targetChineuse={targetChineuse}
      />
    </div>
  )
}