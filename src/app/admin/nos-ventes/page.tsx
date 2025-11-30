// app/admin/nos-ventes/page.tsx
'use client'

import { useMemo, useState } from 'react'
import { useAdmin, Produit } from '@/lib/admin/context'
import ProductList from '@/components/ProductList'
import SyncVentesButton from '@/components/SyncVentesButton'
import { Plus, X } from 'lucide-react'

export default function AdminNosVentesPage() {
  const { selectedChineuse, produitsFiltres, deposants, loading, loadData } = useAdmin()

  // Modals
  const [showModalAjout, setShowModalAjout] = useState(false)
  const [showModalSuppr, setShowModalSuppr] = useState(false)
  const [venteASupprimer, setVenteASupprimer] = useState<Produit | null>(null)

  // Form ajout
  const [selectedSku, setSelectedSku] = useState('')
  const [prixVente, setPrixVente] = useState('')
  const [dateVente, setDateVente] = useState(new Date().toISOString().split('T')[0])
  const [ajoutLoading, setAjoutLoading] = useState(false)

  // Form suppression
  const [remettreEnCaisse, setRemettreEnCaisse] = useState(false)
  const [supprLoading, setSupprLoading] = useState(false)

  // Produits disponibles (non vendus)
  const produitsDisponibles = useMemo(() => {
    return produitsFiltres.filter(p => 
      !p.vendu && (p.quantite ?? 1) > 0 && p.statut !== 'supprime' && p.statut !== 'retour'
    )
  }, [produitsFiltres])

  // Catégories uniques
  const categoriesUniques = useMemo(() => {
    return Array.from(new Set(
      produitsFiltres.map((p) => (typeof p.categorie === 'object' ? p.categorie?.label : p.categorie)).filter(Boolean)
    )) as string[]
  }, [produitsFiltres])

  // Ajout vente
  const handleAjoutVente = async () => {
    const produit = produitsDisponibles.find(p => p.sku === selectedSku)
    if (!produit || !prixVente) return

    setAjoutLoading(true)
    try {
      const res = await fetch('/api/admin-manual-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produitId: produit.id,
          prixVenteReel: parseFloat(prixVente),
          dateVente: new Date(dateVente).toISOString()
        })
      })
      if (res.ok) {
        setShowModalAjout(false)
        setSelectedSku('')
        setPrixVente('')
        await loadData()
      } else {
        alert('Erreur lors de l\'ajout')
      }
    } catch { alert('Erreur') }
    finally { setAjoutLoading(false) }
  }

  // Suppression vente
  const handleSupprVente = async () => {
    if (!venteASupprimer) return

    setSupprLoading(true)
    try {
      const res = await fetch('/api/admin-manual-sale', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produitId: venteASupprimer.id,
          remettreEnCaisse
        })
      })
      if (res.ok) {
        setShowModalSuppr(false)
        setVenteASupprimer(null)
        setRemettreEnCaisse(false)
        await loadData()
      } else {
        alert('Erreur lors de la suppression')
      }
    } catch { alert('Erreur') }
    finally { setSupprLoading(false) }
  }

  // Pré-remplir prix quand on sélectionne un SKU
  const handleSkuChange = (sku: string) => {
    setSelectedSku(sku)
    const p = produitsDisponibles.find(p => p.sku === sku)
    if (p?.prix) setPrixVente(p.prix.toString())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <>
      {/* Actions en haut */}
      <div className="mb-4 flex flex-wrap gap-4 items-center justify-between">
        {/* Sync Square */}
        <div className="flex items-center gap-4">
          {selectedChineuse ? (
            <SyncVentesButton
              uid={selectedChineuse.uid}
              onSyncComplete={loadData}
              showDateFilters={true}
              buttonText={`Sync ventes ${selectedChineuse.trigramme || ''}`}
            />
          ) : (
            <p className="text-sm text-amber-600">
              Sélectionnez une chineuse pour synchroniser ses ventes Square
            </p>
          )}
        </div>

        {/* Bouton Ajouter */}
        <button
          onClick={() => setShowModalAjout(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#22209C] text-white rounded"
        >
          <Plus size={18} /> Ajouter une vente
        </button>
      </div>

      <ProductList
        produits={produitsFiltres}
        categories={categoriesUniques}
        deposants={deposants}
        isAdmin={!selectedChineuse}
        showVentes={true}
        showFilters={true}
        showExport={true}
        showSelection={false}
        showActions={true}
        onDelete={(id) => {
          const p = produitsFiltres.find(p => p.id === id)
          if (p) { setVenteASupprimer(p); setShowModalSuppr(true) }
        }}
      />

      {/* Modal Ajout */}
      {showModalAjout && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Ajouter une vente</h3>
              <button onClick={() => setShowModalAjout(false)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">SKU du produit</label>
                <select
                  value={selectedSku}
                  onChange={(e) => handleSkuChange(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Sélectionner...</option>
                  {produitsDisponibles.map(p => (
                    <option key={p.id} value={p.sku}>{p.sku} - {p.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prix de vente (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={prixVente}
                  onChange={(e) => setPrixVente(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date de vente</label>
                <input
                  type="date"
                  value={dateVente}
                  onChange={(e) => setDateVente(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModalAjout(false)} className="px-4 py-2 border rounded">Annuler</button>
              <button
                onClick={handleAjoutVente}
                disabled={!selectedSku || !prixVente || ajoutLoading}
                className="px-4 py-2 bg-[#22209C] text-white rounded disabled:opacity-50"
              >
                {ajoutLoading ? '...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Suppression */}
      {showModalSuppr && venteASupprimer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">Supprimer cette vente ?</h3>
            <p className="text-sm text-gray-600 mb-4">{venteASupprimer.sku} - {venteASupprimer.nom}</p>
            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={remettreEnCaisse}
                onChange={(e) => setRemettreEnCaisse(e.target.checked)}
              />
              <span>Remettre le produit en caisse ?</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowModalSuppr(false); setVenteASupprimer(null); setRemettreEnCaisse(false) }} className="px-4 py-2 border rounded">Annuler</button>
              <button
                onClick={handleSupprVente}
                disabled={supprLoading}
                className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
              >
                {supprLoading ? '...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}