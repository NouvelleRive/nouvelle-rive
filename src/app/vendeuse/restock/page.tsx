// app/vendeuse/restock/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/lib/firebaseConfig'
import { collection, query, onSnapshot, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from 'lucide-react'
import InventaireList, { Produit, Deposant } from '@/components/InventaireList'


type Tab = 'reception' | 'destock' | 'restock'

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
    const restockEnAttente = produits.filter(
      (p) => (p as any).statutRestock === 'enAttente' && p.statut !== 'supprime'
    ).length
    return { nonRecus, aRecuperer, restockEnAttente }
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
            <button
              onClick={() => setActiveTab('restock')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'restock'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <RefreshCw size={18} />
              <span>Restock</span>
              {counts.restockEnAttente > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                  {counts.restockEnAttente}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'reception' && (
        <InventaireList
          mode="reception"
          produits={produits}
          deposants={deposants}
          vendeusePrenom={vendeusePrenom}
          loading={loading}
        />
      )}

      {activeTab === 'destock' && (
        <InventaireList
          mode="destock"
          produits={produits}
          deposants={deposants}
          vendeusePrenom={vendeusePrenom}
          loading={loading}
        />
      )}

      {activeTab === 'restock' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Demandes de restock ({counts.restockEnAttente})
          </h2>
          {produits
            .filter((p) => (p as any).statutRestock === 'enAttente' && p.statut !== 'supprime')
            .map((p) => {
              const img = p.imageUrls?.[0] || (p.photos as any)?.face || p.imageUrl
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 mb-3 shadow-sm">
                  <div className="flex items-center gap-4">
                    {img ? (
                      <img src={img} alt={p.nom} className="w-16 h-16 object-cover rounded-lg" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">{p.sku}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">
                        <span className="text-[#22209C]">{p.sku}</span> - {(p.nom || '').replace(new RegExp(`^${p.sku}\\s*-\\s*`, 'i'), '')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {typeof p.prix === 'number' ? `${p.prix} €` : '—'} · Qté actuelle: {p.quantite ?? 0}
                      </p>
                      <p className="text-sm text-green-600 font-medium mt-1">
                        + {(p as any).quantiteRestock} demandé(s)
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const qteRestock = (p as any).quantiteRestock || 0
                        const nouvelleQte = (p.quantite ?? 0) + qteRestock
                        try {
                          await updateDoc(doc(db, 'produits', p.id), {
                            quantite: nouvelleQte,
                            statut: 'active',
                            statutRestock: null,
                            quantiteRestock: null,
                            dateDemandeRestock: null,
                            dateRestock: Timestamp.now(),
                            restockParVendeuse: vendeusePrenom,
                          })
                          alert(`✅ ${p.sku} restocké: ${nouvelleQte} unités`)
                        } catch (err) {
                          alert('Erreur lors du restock')
                          console.error(err)
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition flex-shrink-0"
                    >
                      ✓ Valider
                    </button>
                  </div>
                </div>
              )
            })}
          {counts.restockEnAttente === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400">Aucune demande de restock en attente</p>
            </div>
          )}
        </div>
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