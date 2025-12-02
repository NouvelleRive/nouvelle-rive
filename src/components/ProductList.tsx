// components/ProductList.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { db } from '@/lib/firebaseConfig'
import { doc, updateDoc, onSnapshot, Timestamp, writeBatch } from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { 
  MoreHorizontal, Trash2, ChevronUp, Sparkles, 
  Search, X, FileSpreadsheet, Download, ChevronDown, RefreshCw, Plus
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ProductForm from '@/components/ProductForm'

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
  dateVente?: Timestamp
  prixVenteReel?: number
  statut?: 'retour' | 'supprime' | 'vendu'
  dateRetour?: Timestamp | string
  photosReady?: boolean
  catalogObjectId?: string
  variationId?: string
  itemId?: string
  trigramme?: string
}

export type Deposant = {
  id: string
  email: string
  nom?: string
  trigramme?: string
}

interface ProductListProps {
  titre: string
  produits: Produit[]
  deposants?: Deposant[]
  isAdmin?: boolean
  loading?: boolean
}

// =====================
// HELPERS
// =====================
function canUseFashnAI(categorie: string): boolean {
  const cat = (categorie || '').toLowerCase()
  if (
    cat.includes('bague') || cat.includes('boucle') || cat.includes('collier') || 
    cat.includes('bracelet') || cat.includes('broche') || cat.includes('chaussure') || 
    cat.includes('basket') || cat.includes('botte') || cat.includes('bottine') || 
    cat.includes('sandale') || cat.includes('escarpin') || cat.includes('mocassin') ||
    cat.includes('derby') || cat.includes('loafer') || cat.includes('sneaker') || 
    cat.includes('talon') || cat.includes('ceinture') || cat.includes('sac') || 
    cat.includes('foulard') || cat.includes('écharpe') || cat.includes('lunettes') || 
    cat.includes('chapeau') || cat.includes('bonnet') || cat.includes('gant') || 
    cat.includes('montre')
  ) {
    return false
  }
  return true
}

// =====================
// COMPONENT
// =====================
export default function ProductList({
  titre,
  produits,
  deposants = [],
  isAdmin = false,
  loading = false,
}: ProductListProps) {
  // Catégories
  const [categories, setCategories] = useState<{ label: string; idsquare?: string }[]>([])

  // Filtres
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [filtreDeposant, setFiltreDeposant] = useState('')
  const [filtreMois, setFiltreMois] = useState('')

  // Sélection et modifications
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())

  // Menu actions groupées
  const [menuOuvert, setMenuOuvert] = useState(false)

  // Photos expandables
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Modals
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Produit | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteJustification, setDeleteJustification] = useState('')
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([])
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number } | null>(null)

  // Actions
  const [updatingSquare, setUpdatingSquare] = useState(false)
  const [generatingTryonId, setGeneratingTryonId] = useState<string | null>(null)

  // Chargement catégories
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'categories'), (snap) => {
      if (snap.exists()) {
        setCategories(snap.data().list || [])
      }
    })
    return () => unsub()
  }, [])

  const categoriesLabels = categories.map((c) => c.label)

  // Helpers
  const getChineurName = (email: string | undefined) => {
    if (!email) return '—'
    const dep = deposants.find((d) => d.email === email)
    return dep?.nom || email.split('@')[0]
  }

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

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = (checked: boolean, list: Produit[]) => {
    setSelectedIds(checked ? new Set(list.map((p) => p.id)) : new Set())
  }

  // Filtrage
  const produitsFiltres = useMemo(() => {
    const needle = recherche.trim().toLowerCase()
    return produits.filter((p) => {
      if (p.statut === 'supprime') return false
      if (p.vendu || (p.quantite ?? 1) <= 0 || p.statut === 'retour') return false

      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      if (filtreCategorie && cat !== filtreCategorie) return false
      if (filtreDeposant && p.chineur !== filtreDeposant) return false

      if (filtreMois) {
        if (p.createdAt instanceof Timestamp) {
          if (format(p.createdAt.toDate(), 'yyyy-MM') !== filtreMois) return false
        } else {
          return false
        }
      }

      if (needle) {
        const hay = [p.nom, p.sku, p.marque, p.taille, p.description, cat]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }

      return true
    })
  }, [produits, recherche, filtreCategorie, filtreDeposant, filtreMois])

  // Produits récupérés
  const produitsRecuperes = useMemo(() => {
    return produits.filter((p) => p.statut === 'retour')
  }, [produits])

  // Options de filtres
  const deposantsUniques = Array.from(new Set(produits.map((p) => p.chineur).filter(Boolean)))
  const categoriesUniques = categoriesLabels.length > 0 
    ? categoriesLabels 
    : Array.from(new Set(produits.map((p) => (typeof p.categorie === 'object' ? p.categorie?.label : p.categorie)).filter(Boolean)))
  
  const moisUniques = Array.from(
    new Set(
      produits
        .filter((p) => p.createdAt instanceof Timestamp)
        .map((p) => format((p.createdAt as Timestamp).toDate(), 'yyyy-MM'))
    )
  ).sort((a, b) => b.localeCompare(a))

  // =====================
  // CALLBACKS
  // =====================
  const handleEdit = (p: Produit) => {
    setEditingProduct(p)
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    setDeleteTarget(id)
    setBulkDeleteIds([])
    setDeleteJustification('')
    setShowDeleteModal(true)
  }

  const handleDeleteBulk = (ids: string[]) => {
    setBulkDeleteIds(ids)
    setDeleteTarget(null)
    setDeleteJustification('')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deleteJustification.trim()) {
      alert('Veuillez indiquer une justification')
      return
    }

    const idsToDelete = bulkDeleteIds.length > 0 ? bulkDeleteIds : deleteTarget ? [deleteTarget] : []
    if (idsToDelete.length === 0) return

    try {
      if (idsToDelete.length > 5) {
        setDeleteProgress({ current: 0, total: idsToDelete.length })
        
        const batchSize = 10
        for (let i = 0; i < idsToDelete.length; i += batchSize) {
          const batch = writeBatch(db)
          const slice = idsToDelete.slice(i, i + batchSize)
          
          for (const id of slice) {
            batch.update(doc(db, 'produits', id), {
              statut: 'supprime',
              justificationSuppression: deleteJustification,
              dateSuppression: Timestamp.now(),
            })
          }
          
          await batch.commit()
          setDeleteProgress({ current: Math.min(i + batchSize, idsToDelete.length), total: idsToDelete.length })
        }
        
        setDeleteProgress(null)
      } else {
        const batch = writeBatch(db)
        for (const id of idsToDelete) {
          batch.update(doc(db, 'produits', id), {
            statut: 'supprime',
            justificationSuppression: deleteJustification,
            dateSuppression: Timestamp.now(),
          })
        }
        await batch.commit()
      }

      setDirtyIds((prev) => {
        const next = new Set(prev)
        idsToDelete.forEach((id) => next.add(id))
        return next
      })

      setShowDeleteModal(false)
      setDeleteTarget(null)
      setBulkDeleteIds([])
      setDeleteJustification('')
      setSelectedIds(new Set())
      
      alert(`${idsToDelete.length} produit(s) supprimé(s)`)
    } catch (err) {
      console.error('Erreur suppression:', err)
      alert('Erreur lors de la suppression')
      setDeleteProgress(null)
    }
  }

  const handleGenerateTryon = async (p: Produit) => {
    const faceUrl = p.photos?.face || p.imageUrls?.[0] || p.imageUrl
    if (!faceUrl) {
      alert('Aucune photo face disponible')
      return
    }

    setGeneratingTryonId(p.id)
    try {
      const res = await fetch('/api/fashn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garmentUrl: faceUrl }),
      })
      const data = await res.json()

      if (data.resultUrl) {
        await updateDoc(doc(db, 'produits', p.id), {
          'photos.faceOnModel': data.resultUrl,
        })
        alert('Photo portée générée !')
      } else {
        throw new Error(data.error || 'Erreur génération')
      }
    } catch (err: any) {
      console.error('Erreur Fashn:', err)
      alert(err.message || 'Erreur lors de la génération')
    } finally {
      setGeneratingTryonId(null)
    }
  }

  const handleUpdateSquare = async () => {
    const idsToSync = new Set([...selectedIds, ...dirtyIds])
    if (idsToSync.size === 0) {
      alert('Aucun produit à synchroniser')
      return
    }

    setUpdatingSquare(true)
    try {
      const produitsToSync = produits.filter((p) => idsToSync.has(p.id))

      const res = await fetch('/api/square/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produits: produitsToSync }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur sync')

      setDirtyIds(new Set())
      setSelectedIds(new Set())
      alert(`${data.updated || idsToSync.size} produit(s) synchronisé(s) avec Square`)
    } catch (err: any) {
      console.error('Erreur sync Square:', err)
      alert(err.message || 'Erreur lors de la synchronisation')
    } finally {
      setUpdatingSquare(false)
    }
  }

  const handleBatchUpdate = async (field: 'prix' | 'categorie' | 'quantite', value: any) => {
    if (selectedIds.size === 0) return

    try {
      const batch = writeBatch(db)

      for (const id of selectedIds) {
        if (field === 'categorie') {
          const catObj = categories.find((c) => c.label === value)
          batch.update(doc(db, 'produits', id), { categorie: catObj || { label: value } })
        } else {
          batch.update(doc(db, 'produits', id), { [field]: value })
        }
      }

      await batch.commit()

      setDirtyIds((prev) => {
        const next = new Set(prev)
        selectedIds.forEach((id) => next.add(id))
        return next
      })

      alert(`${selectedIds.size} produit(s) mis à jour`)
    } catch (err) {
      console.error('Erreur batch update:', err)
      alert('Erreur lors de la mise à jour')
    }
  }

  const handleFormSuccess = (productId?: string) => {
    setShowForm(false)
    setEditingProduct(null)
    if (productId) {
      setDirtyIds((prev) => new Set(prev).add(productId))
    }
  }

  // Export
  const exportToExcel = () => {
    const data = produitsFiltres.map(p => ({
      SKU: p.sku || '',
      Nom: p.nom,
      Marque: p.marque || '',
      Taille: p.taille || '',
      Catégorie: typeof p.categorie === 'object' ? p.categorie?.label : p.categorie || '',
      'Prix (€)': p.prix || '',
      Quantité: p.quantite || '',
      Chineuse: getChineurName(p.chineur),
      Date: p.createdAt instanceof Timestamp ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produits')
    XLSX.writeFile(wb, `produits_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const exportToPDF = () => {
    const pdfDoc = new jsPDF()
    pdfDoc.setFontSize(18)
    pdfDoc.setTextColor(34, 32, 156)
    pdfDoc.text('Produits', 14, 20)
    pdfDoc.setFontSize(10)
    pdfDoc.setTextColor(100)
    pdfDoc.text(`Exporté le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}`, 14, 28)
    autoTable(pdfDoc, {
      startY: 35,
      head: [['SKU', 'Nom', 'Marque', 'Taille', 'Catégorie', 'Prix', 'Qté', 'Chineuse']],
      body: produitsFiltres.map(p => [
        p.sku || '—',
        (p.nom || '').substring(0, 25),
        p.marque || '—',
        p.taille || '—',
        ((typeof p.categorie === 'object' ? p.categorie?.label : p.categorie) || '').substring(0, 15) || '—',
        typeof p.prix === 'number' ? `${p.prix} €` : '—',
        p.quantite ?? 1,
        getChineurName(p.chineur)?.substring(0, 12) || '—'
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 32, 156] }
    })
    pdfDoc.save(`produits_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  const resetFilters = () => {
    setRecherche('')
    setFiltreCategorie('')
    setFiltreDeposant('')
    setFiltreMois('')
  }

  const hasActiveFilters = recherche || filtreCategorie || filtreDeposant || filtreMois
  const hasChangesToSync = selectedIds.size > 0 || dirtyIds.size > 0

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-[#22209C]">{titre}</h1>
        <button
          onClick={() => {
            setEditingProduct(null)
            setShowForm(true)
          }}
          className="bg-[#22209C] text-white px-4 py-2 rounded flex items-center gap-2 text-sm"
        >
          <Plus size={18} /> Ajouter un produit
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="nom, SKU, marque..."
              className="w-full pl-10 pr-4 py-2 border rounded text-sm"
            />
          </div>

          {isAdmin && (
            <select
              value={filtreDeposant}
              onChange={(e) => setFiltreDeposant(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">Toutes chineuses</option>
              {deposantsUniques.map((email, i) => (
                <option key={i} value={email}>{getChineurName(email)}</option>
              ))}
            </select>
          )}

          <select
            value={filtreCategorie}
            onChange={(e) => setFiltreCategorie(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Toutes catégories</option>
            {categoriesUniques.map((c, i) => (
              <option key={i} value={c as string}>{c}</option>
            ))}
          </select>

          <select
            value={filtreMois}
            onChange={(e) => setFiltreMois(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Tous mois</option>
            {moisUniques.map((m) => (
              <option key={m} value={m}>{format(new Date(m + '-01'), 'MMM yyyy', { locale: fr })}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-gray-600">{produitsFiltres.length} produit(s)</span>
          <div className="flex gap-2 flex-wrap">
            {hasActiveFilters && (
              <button onClick={resetFilters} className="text-sm text-[#22209C] flex items-center gap-1">
                <X size={14} /> Reset
              </button>
            )}
            <button onClick={exportToExcel} className="px-3 py-1 bg-green-600 text-white rounded text-sm flex items-center gap-1">
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={exportToPDF} className="px-3 py-1 bg-red-600 text-white rounded text-sm flex items-center gap-1">
              <Download size={14} /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={handleUpdateSquare}
          disabled={!hasChangesToSync || updatingSquare}
          className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw size={16} className={updatingSquare ? 'animate-spin' : ''} />
          {updatingSquare ? 'Sync...' : 'Mettre à jour en caisse'}
        </button>

        {selectedIds.size > 0 && (
          <div className="relative">
            <button
              onClick={() => setMenuOuvert(!menuOuvert)}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-1"
            >
              Modifier ({selectedIds.size}) <ChevronDown size={16} />
            </button>
            {menuOuvert && (
              <div className="absolute mt-2 w-56 bg-white shadow-lg rounded border z-20">
                <button
                  onClick={() => {
                    const prix = prompt('Nouveau prix ?')
                    if (prix !== null) {
                      handleBatchUpdate('prix', prix === '' ? '' : parseFloat(prix))
                      setMenuOuvert(false)
                    }
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                >
                  Modifier le prix
                </button>
                <button
                  onClick={() => {
                    if (categoriesUniques.length === 0) {
                      alert("Aucune catégorie configurée.")
                      return
                    }
                    const cat = prompt('Catégorie :\n' + categoriesUniques.join(' | '))
                    if (!cat) return
                    if (!categoriesUniques.includes(cat)) {
                      alert('Catégorie invalide')
                      return
                    }
                    handleBatchUpdate('categorie', cat)
                    setMenuOuvert(false)
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                >
                  Modifier la catégorie
                </button>
                <button
                  onClick={() => {
                    const qte = prompt('Nouvelle quantité ?')
                    if (qte !== null) {
                      handleBatchUpdate('quantite', qte === '' ? '' : parseInt(qte))
                      setMenuOuvert(false)
                    }
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                >
                  Modifier la quantité
                </button>
                <button
                  onClick={() => {
                    setMenuOuvert(false)
                    handleDeleteBulk(Array.from(selectedIds))
                  }}
                  className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 text-sm"
                >
                  Supprimer ({selectedIds.size})
                </button>
              </div>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={selectedIds.size === produitsFiltres.length && produitsFiltres.length > 0}
            onChange={(e) => toggleAll(e.target.checked, produitsFiltres)}
            className="rounded"
          />
          Tout sélectionner ({selectedIds.size}/{produitsFiltres.length})
        </label>
      </div>

      {/* Liste produits */}
      <div className="space-y-3">
        {produitsFiltres.map((p) => {
          const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
          const allImages = getAllImages(p)
          const isExpanded = expandedIds.has(p.id)
          const displayImages = isExpanded ? allImages : allImages.slice(0, 2)
          const hasMoreImages = allImages.length > 2

          const canGenerateTryon = canUseFashnAI(cat || '') && 
            (p.photos?.face || allImages[0]) && 
            !p.photos?.faceOnModel

          const isDirty = dirtyIds.has(p.id)
          const isSelected = selectedIds.has(p.id)

          return (
            <div
              key={p.id}
              className={`border rounded-lg p-3 shadow-sm bg-white ${isSelected ? 'ring-2 ring-[#22209C] bg-blue-50' : ''} ${isDirty ? 'border-l-4 border-l-amber-400' : ''}`}
            >
              <div className="flex gap-3">
                <div className="pt-1 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(p.id)}
                    className="w-4 h-4 rounded"
                  />
                </div>

                <div className="flex-shrink-0">
                  {allImages.length > 0 ? (
                    <img
                      src={allImages[0]}
                      alt={p.nom}
                      className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                      onClick={() => window.open(allImages[0], '_blank')}
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">Ø</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.nom}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isAdmin && <span className="text-gray-600">{getChineurName(p.chineur)} • </span>}
                    {p.createdAt instanceof Timestamp ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : '—'}
                  </p>
                  
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs">
                    <span><span className="text-gray-500">SKU:</span> {p.sku ?? '—'}</span>
                    <span><span className="text-gray-500">Prix:</span> {typeof p.prix === 'number' ? `${p.prix} €` : '—'}</span>
                    <span><span className="text-gray-500">Qté:</span> {p.quantite ?? 1}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 flex-shrink-0">
                  {canGenerateTryon && (
                    <button
                      onClick={() => handleGenerateTryon(p)}
                      disabled={generatingTryonId === p.id}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50 transition"
                      title="Générer photo portée avec IA"
                    >
                      {generatingTryonId === p.id ? <span className="text-xs animate-pulse">⏳</span> : <Sparkles size={18} />}
                    </button>
                  )}

                  <button
                    onClick={() => handleEdit(p)}
                    className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded"
                    title="Modifier"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="hidden md:flex gap-4 mt-3 pt-3 border-t text-xs">
                <div className="flex-1">
                  {p.description && <p className="text-gray-500 line-clamp-2">{p.description}</p>}
                </div>
                <div className="flex gap-6">
                  <div className="space-y-1">
                    <p><span className="text-gray-500">Cat:</span> {cat ?? '—'}</p>
                    <p><span className="text-gray-500">Marque:</span> {p.marque ?? '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p><span className="text-gray-500">Taille:</span> {p.taille ?? '—'}</p>
                    {p.material && <p><span className="text-gray-500">Matière:</span> {p.material}</p>}
                  </div>
                </div>
              </div>

              {allImages.length > 1 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex gap-2 items-center flex-wrap">
                    {displayImages.slice(1).map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`${p.nom} ${idx + 2}`}
                        className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80"
                        onClick={() => window.open(url, '_blank')}
                      />
                    ))}

                    {hasMoreImages && !isExpanded && (
                      <button
                        onClick={() => toggleExpanded(p.id)}
                        className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-600 text-xs hover:bg-gray-200 transition"
                      >
                        +{allImages.length - 2}
                      </button>
                    )}

                    {isExpanded && allImages.length > 2 && (
                      <button
                        onClick={() => toggleExpanded(p.id)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ChevronUp size={14} /> Réduire
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {produitsFiltres.length === 0 && (
        <p className="text-center text-gray-400 py-8">Aucun produit</p>
      )}

      {/* Produits récupérés */}
      {produitsRecuperes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-600">Produits récupérés ({produitsRecuperes.length})</h3>
          <div className="space-y-3 opacity-70">
            {produitsRecuperes.map((p) => {
              const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
              const allImages = getAllImages(p)
              const retourDate = p.dateRetour instanceof Timestamp ? p.dateRetour.toDate() : p.dateRetour ? new Date(p.dateRetour as any) : null

              return (
                <div key={p.id} className="border rounded-lg p-3 shadow-sm bg-gray-50 flex gap-3">
                  <div className="w-5 flex-shrink-0" />
                  <div className="flex-shrink-0">
                    {allImages.length > 0 ? (
                      <img src={allImages[0]} alt={p.nom} className="w-16 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">—</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.nom}</p>
                    <p className="text-xs text-amber-600 mt-1">Récupéré le {retourDate ? format(retourDate, 'dd/MM/yyyy') : '—'}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs">
                      <span><span className="text-gray-500">SKU:</span> {p.sku ?? '—'}</span>
                      <span><span className="text-gray-500">Prix:</span> {typeof p.prix === 'number' ? `${p.prix} €` : '—'}</span>
                      <span><span className="text-gray-500">Cat:</span> {cat ?? '—'}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</h2>
              <button onClick={() => { setShowForm(false); setEditingProduct(null) }} className="text-gray-500 hover:text-gray-700 text-xl">×</button>
            </div>
            <div className="p-4">
              <ProductForm
                produit={editingProduct || undefined}
                onSuccess={handleFormSuccess}
                onCancel={() => { setShowForm(false); setEditingProduct(null) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              Supprimer {bulkDeleteIds.length > 0 ? `${bulkDeleteIds.length} produit(s)` : 'ce produit'} ?
            </h3>
            <p className="text-sm text-gray-600 mb-4">Veuillez indiquer la raison de cette suppression :</p>
            <textarea
              value={deleteJustification}
              onChange={(e) => setDeleteJustification(e.target.value)}
              placeholder="Ex: Produit abîmé, erreur de saisie, doublon..."
              className="w-full border rounded p-3 text-sm mb-4"
              rows={3}
            />
            
            {deleteProgress && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Suppression en cours...</span>
                  <span>{deleteProgress.current}/{deleteProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-red-600 h-2 rounded-full transition-all" style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }} />
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setBulkDeleteIds([]) }}
                disabled={!!deleteProgress}
                className="px-4 py-2 border rounded text-sm disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={!deleteJustification.trim() || !!deleteProgress}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
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