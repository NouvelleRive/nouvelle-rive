// app/vendeuse/produits/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebaseConfig'
import { collection, query, onSnapshot } from 'firebase/firestore'
import ProductList, { Produit, Deposant } from '@/components/ProductList'

const VENDEUSES = ['Hina', 'Sofia', 'Loah', 'Teo', 'Salomé']

export default function VendeuseProduits() {
  const [vendeusePrenom, setVendeusePrenom] = useState<string>('')
  const [showVendeuseModal, setShowVendeuseModal] = useState(true)
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'produits')), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Produit))
      setProduits(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'chineuse'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deposant))
      setDeposants(data)
    })
    return () => unsub()
  }, [])

  if (showVendeuseModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-sm w-full p-6">
          <h2 className="text-lg font-semibold mb-4 text-center text-gray-900">
            Qui êtes-vous ?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {VENDEUSES.map((prenom) => (
              <button
                key={prenom}
                onClick={() => {
                  setVendeusePrenom(prenom)
                  setShowVendeuseModal(false)
                }}
                className="p-4 border border-gray-200 rounded-xl text-center hover:border-[#22209C] hover:bg-[#22209C]/5 transition-all font-medium"
              >
                {prenom}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3">
        <p className="text-sm text-gray-500 text-center">
          Connectée : <span className="font-medium">{vendeusePrenom}</span>
        </p>
      </div>
      <ProductList
        titre="Tous les produits"
        produits={produits}
        deposants={deposants}
        isAdmin={false}
        loading={loading}
      />
    </div>
  )
}