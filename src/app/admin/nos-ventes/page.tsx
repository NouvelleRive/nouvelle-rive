// app/admin/nos-ventes/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from '@/lib/admin/context'
import SyncVentesButton from '@/components/SyncVentesButton'
import { Plus, X, Search, Download, Link, Trash2, CheckCircle, AlertCircle } from 'lucide-react'

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

  // Form supprimer
  const [remettreEnStock, setRemettreEnStock] = useState(false)
  const [supprimerLoading, setSupprimerLoading] = useState(false)

  // Charger les ventes
  const loadVentes = async () => {
    setLoadingVentes(true)
    try {
      const url = selectedChineuse?.uid 
        ? `/api/ventes?uid=${selectedChineuse.uid}`
        : '/api/ventes'
      
      const res = await fetch(url)
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
  }, [selectedChineuse?.uid])

  // Produits disponibles (non vendus)
  const produitsDisponibles = useMemo(() => {
    // Si une chineuse est sélectionnée, filtrer ses produits
    // Sinon, afficher tous les produits de toutes les chineuses
    if (selectedChineuse) {
      return produitsFiltres.filter(p => 
        !p.vendu && (p.quantite ?? 1) > 0 && p.statut !== 'supprime' && p.statut !== 'retour'
      )
    } else {
      // Mode admin global - on a besoin de tous les produits
      // Pour l'instant, on utilise produitsFiltres mais en mode admin il faudrait charger tous les produits
      return produitsFiltres.filter(p => 
        !p.vendu && (p.quantite ?? 1) > 0 && p.statut !== 'supprime' && p.statut !== 'retour'
      )
    }
  }, [produitsFiltres, selectedChineuse])

  // Filtrer les ventes
  const ventesFiltrees = useMemo(() => {
    let result = [...ventes]

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
  }, [ventes, searchTerm, filterMois, filterStatut])

  // Liste des mois disponibles
  const moisDisponibles = useMemo(() => {
    const mois = new Set<string>()
    ventes.forEach(v => {
      if (v.dateVente) {
        const date = new Date(v.dateVente)
        mois.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
      }
    })
    return Array.from(mois).sort().reverse()
  }, [ventes])

  // Stats
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

  // Handlers
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
        await loadVentes()
        await loadData()
      } else {
        alert('Erreur: ' + data.error)
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
        await loadData()
      } else {
        alert('Erreur: ' + data.error)
      }
    } catch { alert('Erreur') }
    finally { setSupprimerLoading(false) }
  }

  const handleSkuChange = (sku: string) => {
    setSelectedSku(sku)
    const p = produitsDisponibles.find(p => p.sku === sku)
    if (p?.prix) setPrixVente(p.prix.toString())
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatMois = (moisStr: string) => {
    const [annee, mois] = moisStr.split('-')
    const date = new Date(parseInt(annee), parseInt(mois) - 1)
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }

  if (loading || loadingVentes) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          {selectedChineuse ? (
            <SyncVentesButton
              uid={selectedChineuse.uid}
              onSyncComplete={() => {
                loadVentes()
                loadData()
              }}
              showDateFilters={true}
              buttonText={`Sync ventes ${selectedChineuse.trigramme || ''}`}
            />
          ) : (
            <p className="text-sm text-gray-500">
              Mode admin global — toutes les ventes
            </p>
          )}
        </div>

        <button
          onClick={() => setShowModalAjout(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#22209C] text-white rounded hover:opacity-90"
        >
          <Plus size={18} /> Ajouter une vente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total ventes</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-600">Attribuées</p>
          <p className="text-2xl font-bold text-green-700">{stats.attribuees}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">À attribuer</p>
          <p className="text-2xl font-bold text-red-700">{stats.nonAttribuees}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600">CA (attribuées)</p>
          <p className="text-2xl font-bold text-blue-700">{stats.totalCA.toFixed(0)}€</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Recherche */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher SKU, nom, remarque..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded"
            />
          </div>

          {/* Filtre mois */}
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

          {/* Filtre statut */}
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value as any)}
            className="border rounded px-3 py-2"
          >
            <option value="all">Tous statuts</option>
            <option value="attribue">✅ Attribuées</option>
            <option value="non-attribue">❌ À attribuer</option>
          </select>
        </div>
      </div>

      {/* Liste des ventes */}
      <div className="space-y-2">
        {ventesFiltrees.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Aucune vente trouvée
          </div>
        ) : (
          ventesFiltrees.map(vente => (
            <div
              key={vente.id}
              className={`flex items-center gap-4 p-4 rounded-lg border-l-4 bg-white ${
                vente.isAttribue 
                  ? 'border-l-green-500' 
                  : 'border-l-red-500'
              }`}
            >
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
                    {vente.sku ? `${vente.sku} - ` : ''}{vente.nom || vente.remarque || 'Vente sans nom'}
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
                {!vente.isAttribue && (
                  <button
                    onClick={() => {
                      setVenteSelectionnee(vente)
                      setShowModalAttribuer(true)
                    }}
                    className="p-2 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                    title="Attribuer à un produit"
                  >
                    <Link size={16} />
                  </button>
                )}
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Attribuer la vente</h3>
              <button onClick={() => { setShowModalAttribuer(false); setVenteSelectionnee(null) }}><X size={20} /></button>
            </div>
            
            <div className="bg-amber-50 p-3 rounded mb-4">
              <p className="font-medium">{venteSelectionnee.remarque || venteSelectionnee.nom || 'Vente sans nom'}</p>
              <p className="text-sm text-gray-600">
                {formatDate(venteSelectionnee.dateVente)} • <strong>{venteSelectionnee.prixVenteReel}€</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Attribuer à quel produit ?</label>
              <select
                value={selectedProduitId}
                onChange={(e) => setSelectedProduitId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Sélectionner un produit...</option>
                {produitsDisponibles.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.trigramme}] {p.sku} - {p.nom} ({p.prix}€)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => { setShowModalAttribuer(false); setVenteSelectionnee(null); setSelectedProduitId('') }} 
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