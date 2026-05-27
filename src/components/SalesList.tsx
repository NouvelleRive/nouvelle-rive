// components/SalesList.tsx
'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { RefreshCw, Trash2, Link, CheckCircle, AlertCircle, CheckSquare, Square, Pencil, LayoutGrid, List } from 'lucide-react'
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
  isDeposante?: boolean
  loading?: boolean
  // Callbacks admin
  onAttribuer?: (vente: Vente) => void
  onModifierPrix?: (vente: Vente) => void  
  onSupprimer?: (vente: Vente) => void
  onSupprimerBatch?: (ids: string[]) => void
  onAjouterVente?: () => void
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
  isDeposante = false,
  loading = false,
  onAttribuer,
  onModifierPrix, 
  onSupprimer,
  onSupprimerBatch,
  onAjouterVente,
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
  // DERNIÈRE VENTE (info admin)
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
    return { nb, ca }
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
    <div className="p-2 sm:p-4 max-w-6xl mx-auto">
      
      {/* Header : Titre */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-[#22209C] text-center uppercase">{titre}</h1>
      </div>

      {/* Ligne : Actualiser + Stats */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
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

        {/* Stats — desktop only (mobile: voir ligne Nb · CA · Télécharger dans SalesFilters) */}
        <div className="hidden lg:flex flex-wrap items-center gap-2 flex-1">
          <div className="bg-white border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Total</span>
            <span className="font-bold">{stats.nb}</span>
          </div>
          
          <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-blue-600">CA</span>
            <span className="font-bold text-blue-600">{stats.ca.toFixed(2)}€</span>
          </div>
          {isDeposante && (
            <div className="bg-white border border-[#22209C]/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-xs text-[#22209C]">Ma cagnotte</span>
              <span className="font-bold text-[#22209C]">{(stats.ca * 0.6).toFixed(2)}€</span>
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
        isDeposante={isDeposante}
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

      {/* Toggle vue + Sélection */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg border transition ${viewMode === 'grid' ? 'bg-[#22209C] text-white border-[#22209C]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
            title="Vue grille"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg border transition ${viewMode === 'list' ? 'bg-[#22209C] text-white border-[#22209C]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
            title="Vue liste"
          >
            <List size={16} />
          </button>
        </div>
        {isAdmin && (
          <button onClick={selectAll} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            {selectedIds.size === ventesFiltrées.length && ventesFiltrées.length > 0 ? (
              <CheckSquare size={20} />
            ) : (
              <Square size={20} />
            )}
            <span className="text-sm">
              {selectedIds.size === 0 ? 'Tout sélectionner' : `${selectedIds.size} sélectionnée(s)`}
            </span>
          </button>
        )}
      </div>

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
                <div key={vente.id} className={`bg-white rounded-xl border p-2.5 sm:p-4 shadow-sm ${isAdmin && vente.isAttribue ? 'border-l-4 border-l-green-500' : ''} ${isAdmin && !vente.isAttribue ? 'border-l-4 border-l-amber-500' : ''} ${isSelected ? 'ring-2 ring-blue-300 bg-blue-50' : ''}`}>
                  {/* MOBILE */}
                  <div className="sm:hidden">
                    {/* Ligne haut : checkbox + statut + trigramme + prix + actions */}
                    <div className="flex items-center gap-1.5">
                      {isAdmin && (
                        <button onClick={() => toggleSelect(vente.id)} className="flex-shrink-0 text-gray-400">
                          {isSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
                        </button>
                      )}
                      {isAdmin && (
                        <div className={`flex-shrink-0 ${vente.isAttribue ? 'text-green-500' : 'text-amber-500'}`}>
                          {vente.isAttribue ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        </div>
                      )}
                      {vente.trigramme && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded flex-shrink-0">{vente.trigramme}</span>}
                      <p className="font-bold text-green-600 text-[14px] ml-auto whitespace-nowrap">{prix}€</p>
                      {vente.prixInitial && vente.prixInitial !== prix && <p className="text-[10px] text-gray-400 whitespace-nowrap">({vente.prixInitial}€)</p>}
                      {isAdmin && (
                        <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                          {onAttribuer && <button onClick={() => onAttribuer(vente)} className={`p-1 rounded ${vente.isAttribue ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}><Link size={13} /></button>}
                          {onModifierPrix && <button onClick={() => onModifierPrix(vente)} className="p-1 bg-blue-100 text-blue-600 rounded"><Pencil size={13} /></button>}
                          {onSupprimer && <button onClick={() => onSupprimer(vente)} className="p-1 bg-red-100 text-red-600 rounded"><Trash2 size={13} /></button>}
                        </div>
                      )}
                    </div>

                    {/* Titre sur une ligne dessous */}
                    <h3 className="text-[13px] font-medium text-gray-900 leading-snug mt-2">
                      {vente.sku && <span className="text-[#22209C] font-semibold">{vente.sku}</span>}
                      {vente.sku && <span className="text-gray-400"> · </span>}
                      {(vente.nom || vente.remarque || 'Vente sans nom').replace(new RegExp(`^${vente.sku}\\s*-\\s*`, 'i'), '')}
                    </h3>
                    {vente.description && <p className="text-[12px] text-gray-500 line-clamp-2 mt-0.5">{vente.description}</p>}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Vendu le {format(getDateFromVente(vente), 'dd/MM/yyyy à HH:mm')}{cat && <span> · {cat}</span>}
                      {vente.createdAt && (() => {
                        const entree = typeof (vente.createdAt as any).toDate === 'function' ? (vente.createdAt as any).toDate() : new Date(vente.createdAt as string)
                        const jours = Math.round((getDateFromVente(vente).getTime() - entree.getTime()) / (1000 * 60 * 60 * 24))
                        return <span> · Entré le {format(entree, 'dd/MM/yyyy')} ({jours}j)</span>
                      })()}
                    </p>
                  </div>

                  {/* DESKTOP */}
                  <div className="hidden sm:flex items-start gap-3">
                    {isAdmin && (<button onClick={() => toggleSelect(vente.id)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-1">{isSelected ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} />}</button>)}
                    {isAdmin && (<div className={`flex-shrink-0 mt-1 ${vente.isAttribue ? 'text-green-500' : 'text-amber-500'}`}>{vente.isAttribue ? <CheckCircle size={20} /> : <AlertCircle size={20} />}</div>)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {vente.trigramme && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">{vente.trigramme}</span>}
                        <p className="font-semibold text-gray-900">{vente.sku && <span className="text-[#22209C]">{vente.sku} - </span>}{(vente.nom || vente.remarque || 'Vente sans nom').replace(new RegExp(`^${vente.sku}\\s*-\\s*`, 'i'), '')}</p>
                      </div>
                      {vente.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{vente.description}</p>}
                      <p className="text-sm text-gray-400 mt-1">
                        Vendu le {format(getDateFromVente(vente), 'dd/MM/yyyy à HH:mm')}{cat && <span className="ml-2">• {cat}</span>}
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