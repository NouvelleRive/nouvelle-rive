'use client'

import { useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore'
import ProductList, { Produit } from '@/components/ProductList'
import { useEtapes } from '../layout'

export default function DeposanteMesProduits() {
  const etapes = useEtapes()
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) { setLoading(false); return }

      // Récupérer le trigramme depuis la collection deposante
      let depSnap
      try {
        depSnap = await getDocs(query(collection(db, 'deposante'), where('email', '==', user.email)))
      } catch (e) {
        console.error(e); setLoading(false); return
      }
      if (depSnap.empty) { setLoading(false); return }

      const trigramme = depSnap.docs[0].data().trigramme || ''
      if (!trigramme) { setLoading(false); return }

      const q = query(
        collection(db, 'produits'),
        where('trigramme', '==', trigramme),
        where('source', '==', 'deposante')
      )

      const unsub = onSnapshot(q, (snap) => {
        setProduits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Produit)))
        setLoading(false)
      })

      return () => unsub()
    })

    return () => unsubAuth()
  }, [])

if (!etapes.profil) return <div className="p-12 text-center text-gray-500">Complète ton profil pour continuer →</div>
  if (!etapes.contrat) return <div className="p-12 text-center text-gray-500">Signe ton contrat pour continuer →</div>

  return (
    <ProductList
      titre="MES PIÈCES EN DÉPÔT"
      produits={produits}
      isAdmin={false}
      loading={loading}
    />
  )
}