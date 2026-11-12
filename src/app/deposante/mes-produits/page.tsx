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
    <div>
      <ProductList
        titre="MES PIÈCES EN DÉPÔT"
        produits={produits}
        isAdmin={false}
        isDeposante
        loading={loading}
      />
      <div className="flex justify-center px-4 pb-12">
        <a
          href="/deposante/calendrier"
          style={{
            display: 'inline-block',
            backgroundColor: '#0000FF',
            color: '#fff',
            padding: '18px 40px',
            fontSize: '14px',
            letterSpacing: '0.2em',
            fontWeight: 700,
            textDecoration: 'none',
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,255,0.25)',
          }}
        >
          PRENDRE MON RDV DE DÉPÔT →
        </a>
      </div>
    </div>
  )
}