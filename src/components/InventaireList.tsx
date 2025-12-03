// components/InventaireList.tsx
'use client'

import { useState, useMemo } from 'react'
import { db } from '@/lib/firebaseConfig'
import { doc, updateDoc, Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Search, X, Check, AlertTriangle, Package, PackageCheck,
  ChevronDown, ChevronUp, ImageIcon, Edit3, Filter
} from 'lucide-react'

// =====================
// TYPES
// =====================
export type Produit = {
  id: string
  nom: string
  description?: string
  categorie?: any
  prix?: number
  quantite?: number
  sku?: string
  marque?: string
  taille?: string
  material?: string
  color?: string
  madeIn?: string
  photos?: {
    face?: string
    faceOnModel?: string
    dos?: string
    details?: string[]
  }
  imageUrl?: string
  imageUrls?: string[]
  chineur?: string
  chineurUid?: string
  vendu?: boolean
  createdAt?: Timestamp
  statut?: 'retour' | 'supprime' | 'vendu'
  recu?: boolean
  dateReception?: Timestamp
  recuPar?: string
  enBoutique?: boolean
  dateInventaire?: Timestamp
  inventairePar?: string
  inventaireId?: string
  statutRecuperation?: 'aRecuperer' | 'vole' | null
  dateSignalement?: Timestamp
  signalePar?: string
}

export type Deposant = {
  id: string
  email: string
  nom?: string
  trigramme?: string
}

type Mode = 'inventaire' | 'reception' | 'destock'

interface InventaireListProps {
  mode: Mode
  produits: Produit[]
  deposants?: Deposant[]
  inventaireId?: string
  inventaireNom?: string
  vendeusePrenom: string
  onProductUpdate?: () => void
  loading?: boolean
}

// =====================
// HELPERS
// =====================
const getAllImages = (p: Produit): string[] => {
  if (p.photos) {
    const imgs: string[] = []
    if (p.photos.face) imgs.push(p.photos.face)
    if (p.photos.faceOnModel) imgs.push(p.photos.faceOnModel)
    if (p.photos.dos) imgs.push(p.photos.dos)
    if (p.photos.details) imgs.push(...p.photos.details)
    return imgs
  }
  if (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) return p.imageUrls
  if (p.imageUrl) return [p.imageUrl]
  return []
}

// =====================
// COMPONENT
// =====================
export default function InventaireList({
  mode,
  produits,
  deposants = [],
  inventaireId,
  inventaireNom,
  vendeusePrenom,
  onProductUpdate,
  loading = false,
}: InventaireListProps) {
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [filtreDeposant, setFiltreDeposant] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showSignalModal, setShowSignalModal] = useState(false)
  const [signalTarget, setSignalTarget] = useState<Produit | null>(null)
  const [signalType, setSignalType] = useState<'aRecuperer' | 'vole'>('aRecuperer')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Produit | null>(null)
  const [editValues, setEditValues] = useState<{ prix?: string; taille?: string; marque?: string }>({})
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const getChineurName = (email: string | undefined) => {
    if (!email) return '—'
    const dep = deposants.find((d) => d.email === email)
    return dep?.nom || email.split('@')[0]
  }

  const deposantsUniques = Array.from(new Set(produits.map((p) => p.chineur).filter(Boolean)))
  const categoriesUniques = Array.from(
    new Set(
      produits
        .map((p) => (typeof p.categorie === 'object' ? p.categorie?.label : p.categorie))
        .filter(Boolean)
    )
  )

  const produitsFiltres = useMemo(() => {
    const needle = recherche.trim().toLowerCase()
    return produits.filter((p) => {
      if (p.statut === 'supprime') return false
      
      if (mode === 'inventaire') {
        if (p.vendu || (p.quantite ?? 1) <= 0 || p.statut === 'retour') return false
      } else if (mode === 'reception') {
        if (p.recu !== false) return false
      } else if (mode === 'destock') {
        if (p.statutRecuperation !== 'aRecuperer') return false
      }

      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      if (filtreCategorie && cat !== filtreCategorie) return false
      if (filtreDeposant && p.chineur !== filtreDeposant) return false

      if (needle) {
        const hay = [p.nom, p.sku, p.marque, p.taille, p.description, cat, p.chineur, getChineurName(p.chineur)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }

      return true
    })
  }, [produits, recherche, filtreCategorie, filtreDeposant, mode])

  const produitsParChineuse = useMemo(() => {
    if (mode !== 'inventaire') return null
    const grouped: Record<string, Produit[]> = {}
    for (const p of produitsFiltres) {
      const key = p.chineur || 'Sans chineuse'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(p)
    }
    return grouped
  }, [produitsFiltres, mode])

  const stats = useMemo(() => {
    if (mode === 'inventaire') {
      const total = produitsFiltres.length
      const trouves = produitsFiltres.filter((p) => p.enBoutique && p.inventaireId === inventaireId).length
      return { total, trouves, restants: total - trouves }
    }
    return { total: produitsFiltres.length }
  }, [produitsFiltres, mode, inventaireId])

  const handleMarkFound = async (p: Produit) => {
    if (processingIds.has(p.id)) return
    setProcessingIds((prev) => new Set(prev).add(p.id))

    try {
      await updateDoc(doc(db, 'produits', p.id), {
        enBoutique: true,
        dateInventaire: Timestamp.now(),
        inventairePar: vendeusePrenom,
        inventaireId: inventaireId,
      })
      onProductUpdate?.()
    } catch (err) {
      console.error('Erreur marquage:', err)
      alert('Erreur lors du marquage')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(p.id)
        return next
      })
    }
  }

  const handleUnmarkFound = async (p: Produit) => {
    if (processingIds.has(p.id)) return
    setProcessingIds((prev) => new Set(prev).add(p.id))

    try {
      await updateDoc(doc(db, 'produits', p.id), {
        enBoutique: false,
        dateInventaire: null,
        inventairePar: null,
        inventaireId: null,
      })
      onProductUpdate?.()
    } catch (err) {
      console.error('Erreur annulation:', err)
      alert('Erreur lors de l\'annulation')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(p.id)
        return next
      })
    }
  }

  const handleSignal = async () => {
    if (!signalTarget) return
    setProcessingIds((prev) => new Set(prev).add(signalTarget.id))

    try {
      await updateDoc(doc(db, 'produits', signalTarget.id), {
        statutRecuperation: signalType,
        dateSignalement: Timestamp.now(),
        signalePar: vendeusePrenom,
      })
      setShowSignalModal(false)
      setSignalTarget(null)
      onProductUpdate?.()
    } catch (err) {
      console.error('Erreur signalement:', err)
      alert('Erreur lors du signalement')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(signalTarget?.id || '')
        return next
      })
    }
  }

  const handleMarkReceived = async (p: Produit) => {
    if (processingIds.has(p.id)) return
    setProcessingIds((prev) => new Set(prev).add(p.id))

    try {
      await updateDoc(doc(db, 'produits', p.id), {
        recu: true,
        dateReception: Timestamp.now(),
        recuPar: vendeusePrenom,
      })
      onProductUpdate?.()
    } catch (err) {
      console.error('Erreur réception:', err)
      alert('Erreur lors de la réception')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(p.id)
        return next
      })
    }
  }

  const handleMarkCollected = async (p: Produit) => {
    if (processingIds.has(p.id)) return
    setProcessingIds((prev) => new Set(prev).add(p.id))

    try {
      await updateDoc(doc(db, 'produits', p.id), {
        statut: 'retour',
        dateRetour: Timestamp.now(),
        statutRecuperation: null,
      })
      onProductUpdate?.()
    } catch (err) {
      console.error('Erreur récupération:', err)
      alert('Erreur lors de la récupération')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(p.id)
        return next
      })
    }
  }

  const handleQuickEdit = async () => {
    if (!editTarget) return
    setProcessingIds((prev) => new Set(prev).add(editTarget.id))

    try {
      const updates: Record<string, any> = {}
      if (editValues.prix !== undefined && editValues.prix !== '') {
        updates.prix = parseFloat(editValues.prix)
      }
      if (editValues.taille !== undefined) {
        updates.taille = editValues.taille
      }
      if (editValues.marque !== undefined) {
        updates.marque = editValues.marque
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'produits', editTarget.id), updates)
      }

      setShowEditModal(false)
      setEditTarget(null)
      setEditValues({})
      onProductUpdate?.()
    } catch (err) {
      console.error('Erreur édition:', err)
      alert('Erreur lors de l\'édition')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(editTarget?.id || '')
        return next
      })
    }
  }

  const openEditModal = (p: Produit) => {
    setEditTarget(p)
    setEditValues({
      prix: p.prix?.toString() || '',
      taille: p.taille || '',
      marque: p.marque || '',
    })
    setShowEditModal(true)
  }

  const openSignalModal = (p: Produit) => {
    setSignalTarget(p)
    setSignalType('aRecuperer')
    setShowSignalModal(true)
  }

  const renderProductCard = (p: Produit, showChineuse = false) => {
    const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
    const allImages = getAllImages(p)
    const isProcessing = processingIds.has(p.id)
    const isFound = mode === 'inventaire' && p.enBoutique && p.inventaireId === inventaireId

    return (
      <div
        key={p.id}
        className={`bg-white rounded-xl border p-3 sm:p-4 shadow-sm transition-all ${
          isFound
            ? 'border-green-400 bg-green-50/50'
            : 'border-gray-200 hover:shadow-md'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {allImages.length > 0 ? (
              <img
                src={allImages[0]}
                alt={p.nom}
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(allImages[0], '_blank')}
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 gap-1">
                <ImageIcon size={20} className="text-gray-300" />
                <span className="text-[9px] leading-tight text-center px-1">
                  {p.sku || '—'}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                  {p.sku && <span className="text-[#22209C]">{p.sku}</span>}
                  {p.sku && ' - '}
                  {(p.nom || '').replace(new RegExp(`^${p.sku}\\s*-\\s*`, 'i'), '')}
                </h3>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs sm:text-sm text-gray-500">
                  {p.marque && <span>{p.marque}</span>}
                  {p.taille && <span>T.{p.taille}</span>}
                  {cat && <span className="text-gray-400">{cat}</span>}
                </div>
                {showChineuse && (
                  <p className="text-xs text-gray-400 mt-1">{getChineurName(p.chineur)}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-[#22209C] text-sm sm:text-base">
                  {typeof p.prix === 'number' ? `${p.prix} €` : '—'}
                </p>
                {isFound && (
                  <span className="text-[10px] text-green-600 flex items-center justify-end gap-1 mt-1">
                    <Check size={12} /> Trouvé
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {mode === 'inventaire' && (
                <>
                  {isFound ? (
                    <button
                      onClick={() => handleUnmarkFound(p)}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs sm:text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Annuler
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMarkFound(p)}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs sm:text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Check size={14} />
                      <span className="hidden sm:inline">Trouvé</span>
                      <span className="sm:hidden">OK</span>
                    </button>
                  )}
                  <button
                    onClick={() => openSignalModal(p)}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs sm:text-sm hover:bg-amber-200 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    <AlertTriangle size={14} />
                    <span className="hidden sm:inline">Signaler</span>
                  </button>
                </>
              )}

              {mode === 'reception' && (
                <button
                  onClick={() => handleMarkReceived(p)}
                  disabled={isProcessing}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-[#22209C] text-white rounded-lg text-xs sm:text-sm hover:bg-[#1a1878] disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                >
                  <PackageCheck size={14} />
                  Reçu
                </button>
              )}

              {mode === 'destock' && (
                <button
                  onClick={() => handleMarkCollected(p)}
                  disabled={isProcessing}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs sm:text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                >
                  <Package size={14} />
                  Récupéré
                </button>
              )}

              <button
                onClick={() => openEditModal(p)}
                disabled={isProcessing}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Modifier"
              >
                <Edit3 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-lg sm:text-xl font-bold text-[#22209C]">
          {mode === 'inventaire' && `📋 Inventaire${inventaireNom ? ` - ${inventaireNom}` : ''}`}
          {mode === 'reception' && '📦 Réception'}
          {mode === 'destock' && '↩️ Déstockage'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Connectée en tant que <span className="font-medium">{vendeusePrenom}</span>
        </p>
      </div>

      {mode === 'inventaire' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.trouves}</p>
              <p className="text-xs text-gray-500">Trouvés</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.restants}</p>
              <p className="text-xs text-gray-500">Restants</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 shadow-sm">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="SKU, nom, marque..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
            />
            {recherche && (
              <button
                onClick={() => setRecherche('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 border rounded-lg transition-colors ${
              showFilters || filtreCategorie || filtreDeposant
                ? 'border-[#22209C] bg-[#22209C]/5 text-[#22209C]'
                : 'border-gray-200 text-gray-400 hover:text-gray-600'
            }`}
          >
            <Filter size={18} />
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
            <select
              value={filtreDeposant}
              onChange={(e) => setFiltreDeposant(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
            >
              <option value="">Toutes chineuses</option>
              {deposantsUniques.map((email, i) => (
                <option key={i} value={email}>
                  {getChineurName(email)}
                </option>
              ))}
            </select>
            <select
              value={filtreCategorie}
              onChange={(e) => setFiltreCategorie(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
            >
              <option value="">Toutes catégories</option>
              {categoriesUniques.map((c, i) => (
                <option key={i} value={c as string}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-2">
          {produitsFiltres.length} produit(s)
        </p>
      </div>

      {mode === 'inventaire' && produitsParChineuse ? (
        <div className="space-y-6">
          {Object.entries(produitsParChineuse)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([chineur, prods]) => (
              <div key={chineur}>
                <h2 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <span>{getChineurName(chineur)}</span>
                  <span className="text-xs font-normal text-gray-400">
                    ({prods.filter((p) => p.enBoutique && p.inventaireId === inventaireId).length}/{prods.length})
                  </span>
                </h2>
                <div className="space-y-2">
                  {prods.map((p) => renderProductCard(p, false))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="space-y-2">
          {produitsFiltres.map((p) => renderProductCard(p, true))}
        </div>
      )}

      {produitsFiltres.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">
            {mode === 'reception' && 'Aucun produit en attente de réception'}
            {mode === 'destock' && 'Aucun produit à récupérer'}
            {mode === 'inventaire' && 'Aucun produit trouvé'}
          </p>
        </div>
      )}

      {showSignalModal && signalTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Signaler un problème</h3>
            <p className="text-sm text-gray-500 mb-4">
              {signalTarget.sku || signalTarget.nom}
            </p>

            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="signalType"
                  checked={signalType === 'aRecuperer'}
                  onChange={() => setSignalType('aRecuperer')}
                  className="text-[#22209C]"
                />
                <div>
                  <p className="font-medium text-sm">À récupérer</p>
                  <p className="text-xs text-gray-400">La chineuse doit venir le chercher</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="signalType"
                  checked={signalType === 'vole'}
                  onChange={() => setSignalType('vole')}
                  className="text-[#22209C]"
                />
                <div>
                  <p className="font-medium text-sm">Volé</p>
                  <p className="text-xs text-gray-400">Produit disparu/volé</p>
                </div>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSignalModal(false)
                  setSignalTarget(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSignal}
                disabled={processingIds.has(signalTarget.id)}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                Signaler
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Modifier</h3>

            {/* Photos du produit */}
            {getAllImages(editTarget).length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {getAllImages(editTarget).map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80"
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Prix (€)</label>
                <input
                  type="number"
                  value={editValues.prix || ''}
                  onChange={(e) => setEditValues({ ...editValues, prix: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
                  placeholder="Prix"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Taille</label>
                <input
                  type="text"
                  value={editValues.taille || ''}
                  onChange={(e) => setEditValues({ ...editValues, taille: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
                  placeholder="Taille"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Marque</label>
                <input
                  type="text"
                  value={editValues.marque || ''}
                  onChange={(e) => setEditValues({ ...editValues, marque: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
                  placeholder="Marque"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditTarget(null)
                  setEditValues({})
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleQuickEdit}
                disabled={processingIds.has(editTarget.id)}
                className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm hover:bg-[#1a1878] disabled:opacity-50 transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}