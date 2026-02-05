// app/vendeuse/restock/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/lib/firebaseConfig'
import { collection, query, onSnapshot, getDocs } from 'firebase/firestore'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import InventaireList, { Produit, Deposant } from '@/components/InventaireList'

type Tab = 'reception' | 'destock'

export default function RestockPage() {
  const [vendeusePrenom, setVendeusePrenom] = useState<string>('')
  const [showVendeuseModal, setShowVendeuseModal] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('reception')
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [loading, setLoading] = useState(true)

  const [vendeusesListe, setVendeusesListe] = useState<string[]>([])

  useEffect(() => {
    const fetchVendeuses = async () => {
      const snap = await getDocs(collection(db, 'vendeuses'))
      const noms = snap.docs
        .filter(d => d.data().actif)
        .map(d => d.data().prenom)
        .sort()
      setVendeusesListe(noms)
    }
    fetchVendeuses()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'produits'))
    const unsub = onSnapshot(q, (snap) => {
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

  const counts = useMemo(() => {
    const nonRecus = produits.filter(
      (p) => p.recu === false && p.statut !== 'supprime'
    ).length
    const aRecuperer = produits.filter(
      (p) => p.statutRecuperation === 'aRecuperer' && p.statut !== 'supprime'
    ).length
    return { nonRecus, aRecuperer }
  }, [produits])

  if (showVendeuseModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-sm w-full p-6">
          <h2 className="text-lg font-semibold mb-4 text-center text-gray-900">
            Qui êtes-vous ?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {vendeusesListe.map((prenom) => (
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
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('reception')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'reception'
                  ? 'border-[#22209C] text-[#22209C]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowDownToLine size={18} />
              <span>Réception</span>
              {counts.nonRecus > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-[#22209C] text-white text-xs rounded-full">
                  {counts.nonRecus}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('destock')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'destock'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowUpFromLine size={18} />
              <span>Déstockage</span>
              {counts.aRecuperer > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-amber-600 text-white text-xs rounded-full">
                  {counts.aRecuperer}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'reception' ? (
        <InventaireList
          mode="reception"
          produits={produits}
          deposants={deposants}
          vendeusePrenom={vendeusePrenom}
          loading={loading}
        />
      ) : (
        <InventaireList
          mode="destock"
          produits={produits}
          deposants={deposants}
          vendeusePrenom={vendeusePrenom}
          loading={loading}
        />
      )}

      <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-500">
            Connectée en tant que <span className="font-medium text-gray-700">{vendeusePrenom}</span>
            <button
              onClick={() => setShowVendeuseModal(true)}
              className="ml-2 text-[#22209C] underline"
            >
              Changer
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}