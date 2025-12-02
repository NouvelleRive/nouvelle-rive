// app/admin/nos-ventes/page.tsx
'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { auth } from '@/lib/firebaseConfig'
import SalesList, { Vente } from '@/components/SalesList'
import { X, Search, Link, Trash2 } from 'lucide-react'

// Helper pour récupérer le token
const getAuthToken = async () => {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}

export default function AdminNosVentesPage() {
  const { selectedChineuse, produitsFiltres, loading, loadData } = useAdmin()

  // Ventes
  const [ventes, setVentes] = useState<Vente[]>([])
  const [loadingVentes, setLoadingVentes] = useState(false)

  // Sync
  const [syncLoading, setSyncLoading] = useState(false)

  // Import Excel
  const [importLoading, setImportLoading] = useState(false)

  // Modals
  const [showModalAttribuer, setShowModalAttribuer] = useState(false)
  const [showModalSupprimer, setShowModalSupprimer] = useState(false)
  const [showModalAjout, setShowModalAjout] = useState(false)
  const [venteSelectionnee, setVenteSelectionnee] = useState<Vente | null>(null)

  // Form attribuer
  const [selectedProduitId, setSelectedProduitId] = useState('')
  const [attribuerLoading, setAttribuerLoading] = useState(false)
  const [searchProduit, setSearchProduit] = useState('')
  const [editPrixVente, setEditPrixVente] = useState('')

  // Form supprimer
  const [remettreEnStock, setRemettreEnStock] = useState(false)
  const [supprimerLoading, setSupprimerLoading] = useState(false)

  // Form ajout
  const [selectedSku, setSelectedSku] = useState('')
  const [prixVente, setPrixVente] = useState('')
  const [dateVente, setDateVente] = useState(new Date().toISOString().split('T')[0])
  const [ajoutLoading, setAjoutLoading] = useState(false)

  // Tous les produits (pour attribution)
  const [allProduits, setAllProduits] = useState<any[]>([])

  // Charger tous les produits pour l'attribution
  const loadAllProduits = async () => {
    try {
      const res = await fetch('/api/produits/all')
      const data = await res.json()
      if (data.success && data.produits) {
        setAllProduits(data.produits)
      }
    } catch (err) {
      console.error('Erreur chargement produits:', err)
    }
  }

  useEffect(() => {
    loadAllProduits()
  }, [])

  // Charger les ventes
  const loadVentes = async () => {
    setLoadingVentes(true)
    try {
      const res = await fetch('/api/ventes')
      const data = await res.json()
      if (data.success) {
        setVentes(data.ventes || [])
      }
    } catch (err) {
      console.error('Erreur chargement ventes:', err)
    } finally {
      setLoadingVentes(false)
    }
  }

  useEffect(() => {
    loadVentes()
  }, [])

  // Filtrer les ventes par chineuse sélectionnée
  const ventesFiltrees = useMemo(() => {
    if (!selectedChineuse?.uid) return ventes
    return ventes.filter(v => v.chineurUid === selectedChineuse.uid)
  }, [ventes, selectedChineuse?.uid])

  // Produits disponibles (non vendus)
  const produitsDisponibles = useMemo(() => {
    return produitsFiltres.filter(p =>
      !p.vendu && (p.quantite ?? 1) > 0 && p.statut !== 'supprime' && p.statut !== 'retour'
    )
  }, [produitsFiltres])

  // Produits recherchés (pour modal attribution)
  const produitsRecherches = useMemo(() => {
    if (!searchProduit.trim()) return []
    const term = searchProduit.toLowerCase().trim()

    let filtered = allProduits.filter(p =>
      p.sku?.toLowerCase().includes(term) ||
      p.nom?.toLowerCase().includes(term) ||
      p.trigramme?.toLowerCase().includes(term)
    )

    // Si une vente est sélectionnée, trier par pertinence
    if (venteSelectionnee) {
      const remarque = (venteSelectionnee.remarque || venteSelectionnee.nom || '').toLowerCase()
      const prixVenteVal = venteSelectionnee.prixVenteReel || 0

      const words = remarque.split(/\s+/)
      const trigrammeFromRemarque = words[0]?.match(/^[a-z]{2,4}$/i) ? words[0].toUpperCase() : null

      const catKeywords = ['jupe', 'short', 'robe', 'top', 'haut', 'chemise', 'blouse', 'pull', 'veste', 'blazer', 'pantalon', 'jean', 'manteau', 'coat', 'sac', 'collier', 'bague', 'boucle']
      const catFromRemarque = catKeywords.find(k => remarque.includes(k)) || null

      filtered = filtered.map(p => {
        let score = 0
        const pCat = (typeof p.categorie === 'string' ? p.categorie : p.categorie?.label || '').toLowerCase()

        if (prixVenteVal > 0 && p.prix === prixVenteVal) score += 10000
        if (trigrammeFromRemarque && p.trigramme?.toUpperCase() === trigrammeFromRemarque) score += 1000
        if (catFromRemarque && pCat.includes(catFromRemarque)) score += 100
        if (prixVenteVal > 0 && p.prix && p.prix !== prixVenteVal) {
          const diff = Math.abs(p.prix - prixVenteVal) / prixVenteVal
          if (diff <= 0.15) score += 25
        }

        return { ...p, _score: score }
      })

      filtered.sort((a, b) => (b._score || 0) - (a._score || 0))
    }

    return filtered.slice(0, 100)
  }, [allProduits, searchProduit, venteSelectionnee])

  // ==================== HANDLERS ====================

  // Sync Square
  const handleSync = async (startDate: string, endDate: string) => {
    setSyncLoading(true)
    try {
      const res = await fetch('/api/sync-ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      })
      const data = await res.json()
      if (data.success) {
        alert(`${data.imported || 0} vente(s) synchronisée(s)`)
        await loadVentes()
      } else {
        alert(data.error || 'Erreur sync')
      }
    } catch (e) {
      alert('Erreur de synchronisation')
    } finally {
      setSyncLoading(false)
    }
  }

  // Import Excel
  const handleImportExcel = async (rows: any[]) => {
    setImportLoading(true)
    try {
      const res = await fetch('/api/import-ventes-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      })
      const result = await res.json()
      if (result.success) {
        alert(`${result.imported} vente(s) importée(s)`)
        await loadVentes()
      } else {
        alert(result.error || 'Erreur import')
      }
    } catch (err) {
      alert('Erreur lors de l\'import')
    } finally {
      setImportLoading(false)
    }
  }

  // Ouvrir modal attribution
  const handleAttribuer = (vente: Vente) => {
    setVenteSelectionnee(vente)
    setEditPrixVente(vente.prixVenteReel?.toString() || '')
    setSelectedProduitId('')
    setSearchProduit('')
    setShowModalAttribuer(true)
  }

  // Confirmer attribution
  const handleConfirmAttribuer = async () => {
    if (!venteSelectionnee || !selectedProduitId) return

    setAttribuerLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) {
        alert('Non authentifié')
        return
      }

      const res = await fetch('/api/ventes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          venteId: venteSelectionnee.id,
          produitId: selectedProduitId,
          prixVenteReel: editPrixVente ? parseFloat(editPrixVente) : undefined
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowModalAttribuer(false)
        setVenteSelectionnee(null)
        await loadVentes()
        await loadData()
        await loadAllProduits()
      } else {
        alert(data.error || 'Erreur')
      }
    } catch {
      alert('Erreur')
    } finally {
      setAttribuerLoading(false)
    }
  }

  // Ouvrir modal suppression
  const handleSupprimer = (vente: Vente) => {
    setVenteSelectionnee(vente)
    setRemettreEnStock(false)
    setShowModalSupprimer(true)
  }

  // Confirmer suppression
  const handleConfirmSupprimer = async () => {
    if (!venteSelectionnee) return

    setSupprimerLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) {
        alert('Non authentifié')
        return
      }

      const res = await fetch('/api/ventes', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          venteId: venteSelectionnee.id,
          remettreEnStock
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowModalSupprimer(false)
        setVenteSelectionnee(null)
        await loadVentes()
        if (remettreEnStock) await loadData()
      } else {
        alert(data.error || 'Erreur')
      }
    } catch {
      alert('Erreur')
    } finally {
      setSupprimerLoading(false)
    }
  }

  // Suppression groupée
  const handleSupprimerBatch = async (ids: string[]) => {
    try {
      const token = await getAuthToken()
      if (!token) {
        alert('Non authentifié')
        return
      }

      const res = await fetch('/api/ventes', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ venteIds: ids })
      })
      const data = await res.json()
      if (data.success) {
        await loadVentes()
      } else {
        alert(data.error || 'Erreur')
      }
    } catch {
      alert('Erreur')
    }
  }

  // Ajout manuel
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
        await loadVentes()
        await loadData()
      } else {
        alert('Erreur lors de l\'ajout')
      }
    } catch {
      alert('Erreur')
    } finally {
      setAjoutLoading(false)
    }
  }

  const handleSkuChange = (sku: string) => {
    setSelectedSku(sku)
    const produit = produitsDisponibles.find(p => p.sku === sku)
    if (produit?.prix) {
      setPrixVente(produit.prix.toString())
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-FR')
  }

  // Titre dynamique
  const titre = selectedChineuse
    ? `VENTES DE ${(selectedChineuse.nom || selectedChineuse.email?.split('@')[0] || '').toUpperCase()}`
    : 'TOUTES LES VENTES'

  return (
    <>
      <SalesList
        titre={titre}
        ventes={ventesFiltrees}
        isAdmin={true}
        loading={loading || loadingVentes}
        onAttribuer={handleAttribuer}
        onSupprimer={handleSupprimer}
        onSupprimerBatch={handleSupprimerBatch}
        onAjouterVente={() => setShowModalAjout(true)}
        onSync={handleSync}
        syncLoading={syncLoading}
        onImportExcel={handleImportExcel}
        importLoading={importLoading}
        onRefresh={loadVentes}
      />

      {/* Modal Ajout */}
      {showModalAjout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Ajouter une vente</h3>
              <button onClick={() => setShowModalAjout(false)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Produit</label>
                <select
                  value={selectedSku}
                  onChange={(e) => handleSkuChange(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
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
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date de vente</label>
                <input
                  type="date"
                  value={dateVente}
                  onChange={(e) => setDateVente(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModalAjout(false)} className="px-4 py-2 border rounded-lg">Annuler</button>
              <button
                onClick={handleAjoutVente}
                disabled={!selectedSku || !prixVente || ajoutLoading}
                className="px-4 py-2 bg-[#22209C] text-white rounded-lg disabled:opacity-50"
              >
                {ajoutLoading ? '...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Attribuer */}
      {showModalAttribuer && venteSelectionnee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Attribuer la vente</h3>
              <button onClick={() => { setShowModalAttribuer(false); setVenteSelectionnee(null) }}><X size={20} /></button>
            </div>

            <div className="bg-amber-50 p-3 rounded-lg mb-4">
              <p className="font-medium">{venteSelectionnee.remarque || venteSelectionnee.nom || 'Vente sans nom'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600">{formatDate(venteSelectionnee.dateVente as string)} •</span>
                <input
                  type="number"
                  value={editPrixVente}
                  onChange={(e) => setEditPrixVente(e.target.value)}
                  className="w-20 px-2 py-1 border rounded text-sm font-bold"
                />
                <span className="text-sm font-bold">€</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rechercher par SKU ou nom</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Ex: DM28, veste cuir..."
                    value={searchProduit}
                    onChange={(e) => setSearchProduit(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Produit ({produitsRecherches.length} résultat{produitsRecherches.length > 1 ? 's' : ''})
                </label>
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {produitsRecherches.length === 0 ? (
                    <p className="p-3 text-gray-500 text-sm">
                      {searchProduit ? 'Aucun produit trouvé' : 'Tapez pour rechercher...'}
                    </p>
                  ) : (
                    produitsRecherches.slice(0, 50).map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProduitId(p.id)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 ${
                          selectedProduitId === p.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        } ${p._score >= 10000 ? 'bg-green-50' : p._score >= 1000 ? 'bg-yellow-50' : ''}`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-gray-500">[{p.trigramme}]</span>
                              <span className="font-medium">{p.sku}</span>
                              {p._score >= 10000 && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">Prix exact !</span>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm truncate">{p.nom}</p>
                          </div>
                          <span className="text-green-600 font-medium ml-2">{p.prix}€</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedProduitId && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">
                    <strong>Sélectionné :</strong> {produitsRecherches.find(p => p.id === selectedProduitId)?.sku}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowModalAttribuer(false); setVenteSelectionnee(null) }} className="px-4 py-2 border rounded-lg">
                Annuler
              </button>
              <button
                onClick={handleConfirmAttribuer}
                disabled={!selectedProduitId || attribuerLoading}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg disabled:opacity-50 hover:bg-amber-600"
              >
                {attribuerLoading ? '...' : 'Attribuer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Supprimer */}
      {showModalSupprimer && venteSelectionnee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">Supprimer cette vente ?</h3>
            <p className="text-sm text-gray-600 mb-4">
              {venteSelectionnee.sku ? `${venteSelectionnee.sku} - ` : ''}{venteSelectionnee.nom || venteSelectionnee.remarque}
              <br />
              <strong>{venteSelectionnee.prixVenteReel}€</strong> • {formatDate(venteSelectionnee.dateVente as string)}
            </p>

            {venteSelectionnee.isAttribue && (
              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={remettreEnStock}
                  onChange={(e) => setRemettreEnStock(e.target.checked)}
                  className="rounded"
                />
                <span>Remettre le produit en stock ?</span>
              </label>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowModalSupprimer(false); setVenteSelectionnee(null) }} className="px-4 py-2 border rounded-lg">
                Annuler
              </button>
              <button
                onClick={handleConfirmSupprimer}
                disabled={supprimerLoading}
                className="px-4 py-2 bg-red-500 text-white rounded-lg disabled:opacity-50"
              >
                {supprimerLoading ? '...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}