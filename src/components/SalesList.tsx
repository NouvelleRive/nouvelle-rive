// components/SalesList.tsx
'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { RefreshCw, Trash2, Link, CheckCircle, AlertCircle, CheckSquare, Square, Pencil } from 'lucide-react'
import SalesFilters from '@/components/SalesFilters'
import SalesGrid from '@/components/SalesGrid'

// =====================
// TYPES
// =====================
export interface Vente {
  id: string
  produitId?: string | null
  nom?: string
  description?: string
  sku?: string | null
  categorie?: any
  marque?: string | null
  trigramme?: string | null
  chineur?: string
  chineurUid?: string
  prix?: number
  prixInitial?: number | null
  prixVenteReel?: number
  dateVente?: Timestamp | string | null
  createdAt?: Timestamp | string | null
  remarque?: string | null
  source?: string
  isAttribue?: boolean
  vendu?: boolean
}

export interface ChineuseMeta {
  nom?: string
  commissionHT?: number
  taux?: number
  siret?: string
  adresse1?: string
  adresse2?: string
  tva?: string
  iban?: string
  bic?: string
  banqueAdresse?: string
  codeChineuse?: string
  code?: string
}

interface SalesListProps {
  titre: string
  ventes: Vente[]
  chineuse?: ChineuseMeta | null
  deposants?: any[]
  chineuses?: Array<{ trigramme: string; nom: string }> // Liste des chineuses pour le filtre
  userEmail?: string
  isAdmin?: boolean
  loading?: boolean
  // Callbacks admin
  onAttribuer?: (vente: Vente) => void
  onModifierPrix?: (vente: Vente) => void  
  onSupprimer?: (vente: Vente) => void
  onSupprimerBatch?: (ids: string[]) => void
  onAjouterVente?: () => void
  // Sync
  onSync?: (startDate: string, endDate: string) => Promise<void>
  syncLoading?: boolean
  // Import Excel (admin)
  onImportExcel?: (rows: any[]) => Promise<void>
  importLoading?: boolean
  // Refresh
  onRefresh?: () => void
}

// =====================
// COMPONENT
// =====================
export default function SalesList({
  titre,
  ventes,
  chineuse,
  deposants = [],
  chineuses = [],
  userEmail,
  isAdmin = false,
  loading = false,
  onAttribuer,
  onModifierPrix, 
  onSupprimer,
  onSupprimerBatch,
  onAjouterVente,
  onSync,
  syncLoading = false,
  onImportExcel,
  importLoading = false,
  onRefresh,
}: SalesListProps) {

  // Sélection (admin)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(20)
  const loaderRef = useRef<HTMLDivElement>(null)

  // Vue
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [ventesFiltrées, setVentesFiltrées] = useState<Vente[]>([])

  // =====================
  // HELPERS
  // =====================

  const getDateFromVente = (v: Vente): Date => {
    if (v.dateVente && typeof (v.dateVente as any).toDate === 'function') {
      return (v.dateVente as any).toDate()
    }
    if (typeof v.dateVente === 'string') return new Date(v.dateVente)
    return new Date()
  }

  const getPrix = (v: Vente): number => {
    return typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0)
  }

  const getCategorie = (v: Vente): string => {
    return typeof v.categorie === 'object' ? v.categorie?.label : (v.categorie || '')
  }

  // =====================
  // DERNIÈRE VENTE (pour sync)
  // =====================
  const derniereVenteDate = useMemo(() => {
    if (ventes.length === 0) return null
    const dates = ventes.map(v => getDateFromVente(v)).filter(d => !isNaN(d.getTime()))
    if (dates.length === 0) return null
    return new Date(Math.max(...dates.map(d => d.getTime())))
  }, [ventes])

  // =====================
  // STATS
  // =====================
  const stats = useMemo(() => {
    const nb = ventesFiltrées.length
    const ca = ventesFiltrées.reduce((s, v) => s + getPrix(v), 0)
    const attribuees = ventesFiltrées.filter(v => v.isAttribue).length
    const nonAttribuees = ventesFiltrées.filter(v => !v.isAttribue).length
    return { nb, ca, attribuees, nonAttribuees }
  }, [ventesFiltrées])

  // =====================
  // SÉLECTION (ADMIN)
  // =====================
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const selectAll = () => {
    if (selectedIds.size === ventesFiltrées.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ventesFiltrées.map(v => v.id)))
    }
  }

  const handleDeleteBatch = () => {
    if (onSupprimerBatch && selectedIds.size > 0) {
      onSupprimerBatch(Array.from(selectedIds))
      setSelectedIds(new Set())
      setShowDeleteModal(false)
    }
  }

  // =====================
  // SYNC SIMPLIFIÉ
  // =====================
  const handleSyncRecent = async () => {
    if (!onSync) return
    const startDate = derniereVenteDate
      ? format(derniereVenteDate, 'yyyy-MM-dd')
      : format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    const endDate = format(new Date(), 'yyyy-MM-dd')
    await onSync(startDate, endDate)
  }

  // =====================
  // INFINITE SCROLL
  // =====================
  useEffect(() => {
    const loader = loaderRef.current
    if (!loader) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < ventesFiltrées.length) {
          setVisibleCount(prev => Math.min(prev + 20, ventesFiltrées.length))
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )
    observer.observe(loader)
    return () => observer.disconnect()
  }, [visibleCount, ventesFiltrées.length])

  useEffect(() => {
    setVisibleCount(20)
  }, [ventesFiltrées])

  // =====================
  // RENDER
  // =====================
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      
      {/* Header : Titre */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-[#22209C] text-center uppercase">{titre}</h1>
      </div>

      {/* Ligne : Sync/Actualiser + Stats */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Bouton Sync (admin) */}
        {isAdmin && onSync && (
          <button
            onClick={handleSyncRecent}
            disabled={syncLoading}
            className="flex items-center gap-2 bg-[#22209C] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#1a1a7a] transition-colors"
          >
            <RefreshCw size={16} className={syncLoading ? 'animate-spin' : ''} />
            {syncLoading ? 'Sync...' : 'Synchroniser'}
          </button>
        )}

        {/* Bouton Actualiser (chineuse) */}
        {!isAdmin && onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 bg-[#22209C] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1a1a7a] transition-colors"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        )}

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="bg-white border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Total</span>
            <span className="font-bold">{stats.nb}</span>
          </div>
          
          {isAdmin && (
            <>
              <div className="bg-white border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-green-600">Attribuées</span>
                <span className="font-bold text-green-600">{stats.attribuees}</span>
              </div>
              <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-amber-600">À attribuer</span>
                <span className="font-bold text-amber-600">{stats.nonAttribuees}</span>
              </div>
            </>
          )}
          
          <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-blue-600">CA</span>
            <span className="font-bold text-blue-600">{stats.ca.toFixed(2)}€</span>
          </div>
          {isDeposante && chineuse?.taux && (
            <div className="bg-white border border-[#22209C]/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-xs text-[#22209C]">Ma cagnotte</span>
              <span className="font-bold text-[#22209C]">{(stats.ca * chineuse.taux / 100).toFixed(2)}€</span>
            </div>
          )}
        </div>
      </div>

      {/* Info dernière sync (admin) */}
      {isAdmin && derniereVenteDate && (
        <p className="text-xs text-gray-500 -mt-4 mb-4">
          Dernière vente : {format(derniereVenteDate, 'dd/MM/yyyy', { locale: fr })}
        </p>
      )}

      {/* Filtres + Toggle + Télécharger */}
      <SalesFilters
        ventes={ventes}
        chineuse={chineuse}
        deposants={deposants}
        chineuses={chineuses}
        userEmail={userEmail}
        isAdmin={isAdmin}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onFiltered={setVentesFiltrées}
      />

      {/* Sélection groupée (admin) */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="font-medium">{selectedIds.size} vente{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 border rounded-lg text-sm hover:bg-white"
            >
              Désélectionner
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 flex items-center gap-1"
            >
              <Trash2 size={14} />
              Supprimer
            </button>
          </div>
        </div>
      )}

      {/* Header sélection (admin) */}
      {isAdmin && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg mb-2">
          <button onClick={selectAll} className="text-gray-500 hover:text-gray-700">
            {selectedIds.size === ventesFiltrées.length && ventesFiltrées.length > 0 ? (
              <CheckSquare size={20} />
            ) : (
              <Square size={20} />
            )}
          </button>
          <span className="text-sm text-gray-500">
            {selectedIds.size === 0 ? 'Tout sélectionner' : `${selectedIds.size} sélectionnée(s)`}
          </span>
        </div>
      )}

      {/* Ventes */}
      {viewMode === 'grid' ? (
        <SalesGrid
          ventes={ventesFiltrées.slice(0, visibleCount)}
          isAdmin={isAdmin}
          onAttribuer={onAttribuer}
          onModifierPrix={onModifierPrix}
          onSupprimer={onSupprimer}
        />
      ) : (
        <div className="space-y-3">
          {ventesFiltrées.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <p className="text-gray-400">Aucune vente</p>
            </div>
          ) : (
            ventesFiltrées.slice(0, visibleCount).map(vente => {
              const cat = getCategorie(vente)
              const prix = getPrix(vente)
              const isSelected = selectedIds.has(vente.id)
              return (
                <div key={vente.id} className={`bg-white rounded-xl border p-4 shadow-sm ${isAdmin && vente.isAttribue ? 'border-l-4 border-l-green-500' : ''} ${isAdmin && !vente.isAttribue ? 'border-l-4 border-l-amber-500' : ''} ${isSelected ? 'ring-2 ring-blue-300 bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    {isAdmin && (<button onClick={() => toggleSelect(vente.id)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-1">{isSelected ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} />}</button>)}
                    {isAdmin && (<div className={`flex-shrink-0 mt-1 ${vente.isAttribue ? 'text-green-500' : 'text-amber-500'}`}>{vente.isAttribue ? <CheckCircle size={20} /> : <AlertCircle size={20} />}</div>)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {vente.trigramme && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">{vente.trigramme}</span>}
                        <p className="font-semibold text-gray-900">{vente.sku && <span className="text-[#22209C]">{vente.sku} - </span>}{(vente.nom || vente.remarque || 'Vente sans nom').replace(new RegExp(`^${vente.sku}\\s*-\\s*`, 'i'), '')}</p>
                      </div>
                      {vente.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{vente.description}</p>}
                      <p className="text-sm text-gray-400 mt-1">
                        Vendu le {format(getDateFromVente(vente), 'dd/MM/yyyy')}{cat && <span className="ml-2">• {cat}</span>}
                        {vente.createdAt && (() => {
                          const entree = typeof (vente.createdAt as any).toDate === 'function' ? (vente.createdAt as any).toDate() : new Date(vente.createdAt as string)
                          const jours = Math.round((getDateFromVente(vente).getTime() - entree.getTime()) / (1000 * 60 * 60 * 24))
                          return <span className="ml-2">• Entré le {format(entree, 'dd/MM/yyyy')} · {jours}j</span>
                        })()}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-green-600 text-lg">{prix}€</p>
                      {vente.prixInitial && vente.prixInitial !== prix && <p className="text-xs text-gray-400">Initial: {vente.prixInitial}€</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {onAttribuer && <button onClick={() => onAttribuer(vente)} className={`p-2 rounded-lg ${vente.isAttribue ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}><Link size={16} /></button>}
                        {onModifierPrix && <button onClick={() => onModifierPrix(vente)} className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Pencil size={16} /></button>}
                        {onSupprimer && <button onClick={() => onSupprimer(vente)} className="p-2 bg-red-100 text-red-600 rounded-lg"><Trash2 size={16} /></button>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Loader infinite scroll */}
      {visibleCount < ventesFiltrées.length && (
        <div ref={loaderRef} className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
        </div>
      )}

      {/* Modal suppression groupée */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              Supprimer {selectedIds.size} vente{selectedIds.size > 1 ? 's' : ''} ?
            </h3>
            <p className="text-gray-600 mb-4">Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteBatch}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}