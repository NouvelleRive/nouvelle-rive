// app/admin/nos-ventes/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from '@/lib/admin/context'
import SyncVentesButton from '@/components/SyncVentesButton'
import { Plus, X, Search, Download, Link, Trash2, CheckCircle, AlertCircle, RefreshCw, CheckSquare, Square } from 'lucide-react'

interface Vente {
  id: string
  produitId: string | null
  nom: string
  sku: string | null
  categorie: string | null
  marque: string | null
  trigramme: string | null
  chineurUid: string
  prixInitial: number | null
  prixVenteReel: number
  dateVente: string
  remarque: string | null
  source: string
  isAttribue: boolean
}

export default function AdminNosVentesPage() {
  const { selectedChineuse, produitsFiltres, deposants, loading, loadData } = useAdmin()

  // Ventes
  const [ventes, setVentes] = useState<Vente[]>([])
  const [loadingVentes, setLoadingVentes] = useState(false)

  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingBatch, setDeletingBatch] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0 })

  // Filtres
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMois, setFilterMois] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<'all' | 'attribue' | 'non-attribue'>('all')

  // Modals
  const [showModalAjout, setShowModalAjout] = useState(false)
  const [showModalAttribuer, setShowModalAttribuer] = useState(false)
  const [showModalSupprimer, setShowModalSupprimer] = useState(false)
  const [venteSelectionnee, setVenteSelectionnee] = useState<Vente | null>(null)

  // Form ajout
  const [selectedSku, setSelectedSku] = useState('')
  const [prixVente, setPrixVente] = useState('')
  const [dateVente, setDateVente] = useState(new Date().toISOString().split('T')[0])
  const [ajoutLoading, setAjoutLoading] = useState(false)

  // Form attribuer
  const [selectedProduitId, setSelectedProduitId] = useState('')
  const [attribuerLoading, setAttribuerLoading] = useState(false)
  const [searchProduit, setSearchProduit] = useState('')

  // Produits recherchés (pour modal attribution)
  const [allProduits, setAllProduits] = useState<any[]>([])

  // Charger TOUS les produits pour l'attribution (pas seulement ceux de la chineuse sélectionnée)
  const loadAllProduits = async () => {
    try {
      const res = await fetch('/api/produits?all=true')
      const data = await res.json()
      if (data.produits) {
        setAllProduits(data.produits.filter((p: any) => 
          !p.vendu && (p.quantite ?? 1) > 0 && p.statut !== 'supprime' && p.statut !== 'retour'
        ))
      }
    } catch (err) {
      console.error('Erreur chargement produits:', err)
    }
  }

  useEffect(() => {
    loadAllProduits()
  }, [])

  // Filtrer les produits selon la recherche
  const produitsRecherches = useMemo(() => {
    if (!searchProduit.trim()) return []
    const term = searchProduit.toLowerCase().trim()
    return allProduits.filter(p => 
      p.sku?.toLowerCase().includes(term) ||
      p.nom?.toLowerCase().includes(term) ||
      p.trigramme?.toLowerCase().includes(term)
    ).slice(0, 100)
  }, [allProduits, searchProduit])

  // Form supprimer
  const [remettreEnStock, setRemettreEnStock] = useState(false)
  const [supprimerLoading, setSupprimerLoading] = useState(false)

  // Sync global
  const [syncGlobalLoading, setSyncGlobalLoading] = useState(false)
  const [syncStartDate, setSyncStartDate] = useState('')
  const [syncEndDate, setSyncEndDate] = useState('')

  // Charger les ventes - TOUJOURS charger toutes les ventes puis filtrer côté client
  const loadVentes = async () => {
    setLoadingVentes(true)
    try {
      // Toujours charger TOUTES les ventes (le filtre se fait côté client)
      const res = await fetch('/api/ventes')
      const data = await res.json()
      if (data.success) {
        setVentes(data.ventes || [])
        console.log(`✅ ${data.ventes?.length || 0} ventes chargées`)
      }
    } catch (err) {
      console.error('Erreur chargement ventes:', err)
    } finally {
      setLoadingVentes(false)
    }
  }

  // Charger au montage
  useEffect(() => {
    loadVentes()
  }, [])

  // Produits disponibles (non vendus)
  const produitsDisponibles = useMemo(() => {
    return produitsFiltres.filter(p => 
      !p.vendu && (p.quantite ?? 1) > 0 && p.statut !== 'supprime' && p.statut !== 'retour'
    )
  }, [produitsFiltres])

  // Filtrer les ventes - INCLUANT le filtre par chineuse
  const ventesFiltrees = useMemo(() => {
    let result = [...ventes]

    // FILTRE PAR CHINEUSE (le plus important!)
    if (selectedChineuse?.uid) {
      result = result.filter(v => v.chineurUid === selectedChineuse.uid)
    }

    // Filtre recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(v => 
        v.nom?.toLowerCase().includes(term) ||
        v.sku?.toLowerCase().includes(term) ||
        v.remarque?.toLowerCase().includes(term) ||
        v.trigramme?.toLowerCase().includes(term)
      )
    }

    // Filtre mois
    if (filterMois !== 'all') {
      result = result.filter(v => {
        if (!v.dateVente) return false
        const date = new Date(v.dateVente)
        const moisAnnee = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        return moisAnnee === filterMois
      })
    }

    // Filtre statut
    if (filterStatut === 'attribue') {
      result = result.filter(v => v.isAttribue)
    } else if (filterStatut === 'non-attribue') {
      result = result.filter(v => !v.isAttribue)
    }

    return result
  }, [ventes, selectedChineuse?.uid, searchTerm, filterMois, filterStatut])

  // Liste des mois disponibles (basée sur les ventes filtrées par chineuse)
  const moisDisponibles = useMemo(() => {
    const ventesChineuse = selectedChineuse?.uid 
      ? ventes.filter(v => v.chineurUid === selectedChineuse.uid)
      : ventes
    
    const mois = new Set<string>()
    ventesChineuse.forEach(v => {
      if (v.dateVente) {
        const date = new Date(v.dateVente)
        mois.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
      }
    })
    return Array.from(mois).sort().reverse()
  }, [ventes, selectedChineuse?.uid])

  // Stats (basées sur ventes filtrées)
  const stats = useMemo(() => {
    const attribuees = ventesFiltrees.filter(v => v.isAttribue)
    const nonAttribuees = ventesFiltrees.filter(v => !v.isAttribue)
    const totalCA = attribuees.reduce((sum, v) => sum + (v.prixVenteReel || 0), 0)
    return {
      total: ventesFiltrees.length,
      attribuees: attribuees.length,
      nonAttribuees: nonAttribuees.length,
      totalCA,
    }
  }, [ventesFiltrees])

  // Sélection
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const selectAll = () => {
    if (selectedIds.size === ventesFiltrees.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ventesFiltrees.map(v => v.id)))
    }
  }

  // Suppression groupée - utilise l'API batch
  const handleDeleteBatch = async () => {
    if (selectedIds.size === 0) return
    
    setDeletingBatch(true)
    setDeleteProgress({ done: 0, total: selectedIds.size })
    
    try {
      // Utiliser l'API batch pour supprimer toutes les ventes d'un coup
      const res = await fetch('/api/ventes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venteIds: Array.from(selectedIds) })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setDeleteProgress({ done: selectedIds.size, total: selectedIds.size })
        setShowDeleteModal(false)
        setSelectedIds(new Set())
        await loadVentes()
      } else {
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch (err) {
      console.error('Erreur suppression batch:', err)
      alert('Erreur lors de la suppression')
    } finally {
      setDeletingBatch(false)
    }
  }

  // Handlers existants
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
    } catch { alert('Erreur') }
    finally { setAjoutLoading(false) }
  }

  const handleAttribuerVente = async () => {
    if (!venteSelectionnee || !selectedProduitId) return

    setAttribuerLoading(true)
    try {
      const res = await fetch('/api/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venteId: venteSelectionnee.id,
          produitId: selectedProduitId
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowModalAttribuer(false)
        setVenteSelectionnee(null)
        setSelectedProduitId('')
        setSearchProduit('')
        await loadVentes()
        await loadData()
        await loadAllProduits()
      } else {
        alert(data.error || 'Erreur')
      }
    } catch { alert('Erreur') }
    finally { setAttribuerLoading(false) }
  }

  const handleSupprimerVente = async () => {
    if (!venteSelectionnee) return

    setSupprimerLoading(true)
    try {
      const res = await fetch('/api/ventes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venteId: venteSelectionnee.id,
          remettreEnStock
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowModalSupprimer(false)
        setVenteSelectionnee(null)
        setRemettreEnStock(false)
        await loadVentes()
        if (remettreEnStock) await loadData()
      } else {
        alert(data.error || 'Erreur')
      }
    } catch { alert('Erreur') }
    finally { setSupprimerLoading(false) }
  }

  const handleSkuChange = (sku: string) => {
    setSelectedSku(sku)
    const produit = produitsDisponibles.find(p => p.sku === sku)
    if (produit?.prix) {
      setPrixVente(produit.prix.toString())
    }
  }

  const handleSyncGlobal = async () => {
    if (!syncStartDate || !syncEndDate) {
      alert('Veuillez sélectionner une période')
      return
    }
    
    setSyncGlobalLoading(true)
    try {
      const res = await fetch('/api/sync-ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: syncStartDate,
          endDate: syncEndDate
        })
      })
      const data = await res.json()
      if (data.success) {
        alert(`Sync terminé: ${data.imported || 0} ventes importées`)
        await loadVentes()
      } else {
        alert(data.error || 'Erreur sync')
      }
    } catch (e) {
      alert('Erreur de synchronisation')
    } finally {
      setSyncGlobalLoading(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-FR')
  }

  const formatMois = (mois: string) => {
    const [year, month] = mois.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }

  if (loading || loadingVentes) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <>
      {/* Header avec sync */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          {selectedChineuse && (
            <span className="px-3 py-1 bg-gray-100 rounded text-sm font-medium">
              {selectedChineuse.trigramme}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Sync par période */}
          <div className="flex items-center gap-2">
            <div>
              <label className="block text-xs text-gray-500">Début</label>
              <input 
                type="date" 
                value={syncStartDate}
                onChange={(e) => setSyncStartDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Fin</label>
              <input 
                type="date" 
                value={syncEndDate}
                onChange={(e) => setSyncEndDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <button
              onClick={handleSyncGlobal}
              disabled={syncGlobalLoading || !syncStartDate || !syncEndDate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 mt-4"
            >
              <RefreshCw size={16} className={syncGlobalLoading ? 'animate-spin' : ''} />
              {syncGlobalLoading ? 'Sync...' : `Sync ventes ${selectedChineuse?.trigramme || ''}`}
            </button>
          </div>

          <button
            onClick={() => setShowModalAjout(true)}
            className="flex items-center gap-2 px-4 py-2 border-2 border-[#22209C] text-[#22209C] rounded text-sm hover:bg-[#22209C] hover:text-white mt-4"
          >
            <Plus size={16} />
            Ajouter une vente
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total ventes</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600">Attribuées</p>
          <p className="text-2xl font-bold text-blue-600">{stats.attribuees}</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-600">À attribuer</p>
          <p className="text-2xl font-bold text-amber-600">{stats.nonAttribuees}</p>
        </div>
        <div className="bg-white border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-600">CA (attribuées)</p>
          <p className="text-2xl font-bold text-green-600">{stats.totalCA}€</p>
        </div>
      </div>

      {/* Barre d'actions groupées */}
      {selectedIds.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <span className="font-medium">{selectedIds.size} vente{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 border rounded text-sm hover:bg-white"
            >
              Désélectionner
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 flex items-center gap-1"
            >
              <Trash2 size={14} />
              Supprimer ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher SKU, nom, remarque..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded"
          />
        </div>

        <select
          value={filterMois}
          onChange={(e) => setFilterMois(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="all">Tous les mois</option>
          {moisDisponibles.map(m => (
            <option key={m} value={m}>{formatMois(m)}</option>
          ))}
        </select>

        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value as any)}
          className="border rounded px-3 py-2"
        >
          <option value="all">Tous statuts</option>
          <option value="attribue">Attribuées</option>
          <option value="non-attribue">Non attribuées</option>
        </select>
      </div>

      {/* Liste des ventes */}
      <div className="space-y-2">
        {/* Header sélection */}
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded">
          <button onClick={selectAll} className="text-gray-500 hover:text-gray-700">
            {selectedIds.size === ventesFiltrees.length && ventesFiltrees.length > 0 ? (
              <CheckSquare size={20} />
            ) : (
              <Square size={20} />
            )}
          </button>
          <span className="text-sm text-gray-500">
            {selectedIds.size === 0 ? 'Tout sélectionner' : `${selectedIds.size} sélectionnée(s)`}
          </span>
        </div>

        {ventesFiltrees.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Aucune vente trouvée</p>
          </div>
        ) : (
          ventesFiltrees.map((vente) => (
            <div
              key={vente.id}
              className={`flex items-center gap-4 p-4 bg-white border rounded-lg ${
                vente.isAttribue ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-amber-500'
              } ${selectedIds.has(vente.id) ? 'ring-2 ring-blue-300 bg-blue-50' : ''}`}
            >
              {/* Checkbox */}
              <button 
                onClick={() => toggleSelect(vente.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                {selectedIds.has(vente.id) ? (
                  <CheckSquare size={20} className="text-blue-500" />
                ) : (
                  <Square size={20} />
                )}
              </button>

              {/* Icône statut */}
              <div className={`flex-shrink-0 ${vente.isAttribue ? 'text-green-500' : 'text-red-500'}`}>
                {vente.isAttribue ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
              </div>

              {/* Infos principales */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {vente.trigramme && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                      {vente.trigramme}
                    </span>
                  )}
                  <p className="font-medium truncate">
                    {vente.sku && <span className="text-gray-500">{vente.sku} - </span>}
                    {vente.nom?.replace(/^\d+\s*-\s*/, '') || vente.remarque || 'Vente sans nom'}
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  {formatDate(vente.dateVente)}
                  {vente.remarque && !vente.isAttribue && (
                    <span className="ml-2 text-amber-600">• {vente.remarque}</span>
                  )}
                </p>
              </div>

              {/* Prix */}
              <div className="text-right">
                <p className="font-bold text-green-600">{vente.prixVenteReel}€</p>
                {vente.prixInitial && (
                  <p className="text-xs text-gray-400">Initial: {vente.prixInitial}€</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setVenteSelectionnee(vente)
                    setShowModalAttribuer(true)
                  }}
                  className={`p-2 rounded ${vente.isAttribue ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                  title={vente.isAttribue ? 'Réattribuer à un autre produit' : 'Attribuer à un produit'}
                >
                  <Link size={16} />
                </button>
                <button
                  onClick={() => {
                    setVenteSelectionnee(vente)
                    setShowModalSupprimer(true)
                  }}
                  className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Suppression groupée */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">Supprimer {selectedIds.size} vente{selectedIds.size > 1 ? 's' : ''} ?</h3>
            
            <p className="text-gray-600 mb-4">
              Cette action est irréversible. Les ventes seront définitivement supprimées.
            </p>

            {deletingBatch && (
              <div className="mb-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${(deleteProgress.done / deleteProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">{deleteProgress.done} / {deleteProgress.total}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowDeleteModal(false)} 
                disabled={deletingBatch}
                className="px-4 py-2 border rounded disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteBatch}
                disabled={deletingBatch}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                {deletingBatch ? `Suppression...` : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <label className="block text-sm font-medium mb-1">Produit</label>
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

      {/* Modal Attribuer */}
      {showModalAttribuer && venteSelectionnee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Attribuer la vente</h3>
              <button onClick={() => { setShowModalAttribuer(false); setVenteSelectionnee(null); setSearchProduit('') }}><X size={20} /></button>
            </div>
            
            <div className="bg-amber-50 p-3 rounded mb-4">
              <p className="font-medium">{venteSelectionnee.remarque || venteSelectionnee.nom || 'Vente sans nom'}</p>
              <p className="text-sm text-gray-600">
                {formatDate(venteSelectionnee.dateVente)} • <strong>{venteSelectionnee.prixVenteReel}€</strong>
              </p>
            </div>

            <div className="space-y-4">
              {/* Recherche par SKU */}
              <div>
                <label className="block text-sm font-medium mb-1">Rechercher par SKU ou nom</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Ex: DM28, SOIR0023, veste cuir..."
                    value={searchProduit}
                    onChange={(e) => setSearchProduit(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded"
                    autoFocus
                  />
                </div>
              </div>

              {/* Liste des produits filtrés */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Produit ({produitsRecherches.length} résultat{produitsRecherches.length > 1 ? 's' : ''})
                </label>
                <div className="border rounded max-h-60 overflow-y-auto">
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
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-mono text-sm text-gray-500">[{p.trigramme}]</span>
                            <span className="font-medium ml-1">{p.sku}</span>
                            <span className="text-gray-600 ml-2">{p.nom}</span>
                          </div>
                          <span className="text-green-600 font-medium">{p.prix}€</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Produit sélectionné */}
              {selectedProduitId && (
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-sm text-green-700">
                    <strong>Sélectionné :</strong> {produitsRecherches.find(p => p.id === selectedProduitId)?.sku} - {produitsRecherches.find(p => p.id === selectedProduitId)?.nom}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => { setShowModalAttribuer(false); setVenteSelectionnee(null); setSelectedProduitId(''); setSearchProduit('') }} 
                className="px-4 py-2 border rounded"
              >
                Annuler
              </button>
              <button
                onClick={handleAttribuerVente}
                disabled={!selectedProduitId || attribuerLoading}
                className="px-4 py-2 bg-amber-500 text-white rounded disabled:opacity-50 hover:bg-amber-600"
              >
                {attribuerLoading ? '...' : 'Attribuer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Supprimer */}
      {showModalSupprimer && venteSelectionnee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">Supprimer cette vente ?</h3>
            <p className="text-sm text-gray-600 mb-4">
              {venteSelectionnee.sku ? `${venteSelectionnee.sku} - ` : ''}{venteSelectionnee.nom || venteSelectionnee.remarque}
              <br />
              <strong>{venteSelectionnee.prixVenteReel}€</strong> • {formatDate(venteSelectionnee.dateVente)}
            </p>
            
            {venteSelectionnee.isAttribue && (
              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={remettreEnStock}
                  onChange={(e) => setRemettreEnStock(e.target.checked)}
                />
                <span>Remettre le produit en stock ?</span>
              </label>
            )}

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => { setShowModalSupprimer(false); setVenteSelectionnee(null); setRemettreEnStock(false) }} 
                className="px-4 py-2 border rounded"
              >
                Annuler
              </button>
              <button
                onClick={handleSupprimerVente}
                disabled={supprimerLoading}
                className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
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