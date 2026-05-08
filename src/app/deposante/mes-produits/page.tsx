'use client'

import { useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore'
import ProductList, { Produit } from '@/components/ProductList'
import { useEtapes } from '../layout'

export default function DeposanteMesProduits() {
  const etapes = useEtapes()
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProduits: (() => void) | undefined
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return }

      // Récupérer le trigramme par doc(uid) direct (cohérent avec profil)
      let trigramme = ''
      try {
        const snap = await getDoc(doc(db, 'deposante', user.uid))
        if (snap.exists()) {
          trigramme = (snap.data() as any)?.trigramme || ''
        } else {
          const fb = await getDocs(query(collection(db, 'deposante'), where('authUid', '==', user.uid)))
          if (!fb.empty) trigramme = (fb.docs[0].data() as any)?.trigramme || ''
        }
      } catch (e) {
        console.error(e); setLoading(false); return
      }
      if (!trigramme) { setLoading(false); return }

      const q = query(
        collection(db, 'produits'),
        where('trigramme', '==', trigramme),
        where('source', '==', 'deposante')
      )

      unsubProduits = onSnapshot(q, (snap) => {
        setProduits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Produit)))
        setLoading(false)
      })
    })

    return () => { unsubAuth(); unsubProduits?.() }
  }, [])

if (!etapes.profil) return <div className="p-12 text-center text-gray-500">Complète ton profil pour continuer →</div>
  if (!etapes.contrat) return <div className="p-12 text-center text-gray-500">Signe ton contrat pour continuer →</div>
  if (!etapes.validee) return <div className="p-12 text-center text-gray-500">Profil en cours de validation 💙 — vous recevrez un email dès que c'est bon.</div>

  return (
    <ProductList
      titre="MES PIÈCES EN DÉPÔT"
      produits={produits}
      isAdmin={false}
      loading={loading}
    />
  )
}