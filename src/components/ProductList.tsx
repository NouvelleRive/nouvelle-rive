// components/ProductList.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { db } from '@/lib/firebaseConfig'
import { doc, updateDoc, onSnapshot, Timestamp, writeBatch, deleteField } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { 
  MoreHorizontal, Trash2, ChevronUp, Sparkles, 
  Search, X, FileSpreadsheet, Download, ChevronDown, RefreshCw, ImageIcon
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ProductForm, { ProductFormData } from '@/components/ProductForm'

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

  // Sélection interne
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

  // Sauvegarde produit (modification)
  const handleSaveProduct = async (data: ProductFormData) => {
    if (!editingProduct) return
    
    try {
      const storage = getStorage()
      const productId = editingProduct.id
      
      // Upload des nouvelles photos
      const uploadPhoto = async (file: File, path: string): Promise<string> => {
        const storageRef = ref(storage, path)
        await uploadBytes(storageRef, file)
        return getDownloadURL(storageRef)
      }
      
      // Préparer les URLs des photos
      let faceUrl: string | undefined = editingProduct.photos?.face
      let dosUrl: string | undefined = editingProduct.photos?.dos
      let faceOnModelUrl: string | undefined = editingProduct.photos?.faceOnModel
      
      // Gérer les photos détails existantes (filtrer les supprimées)
      let detailsUrls = [...(editingProduct.photos?.details || [])]
      if (data.deletedPhotos.detailsIndexes && data.deletedPhotos.detailsIndexes.length > 0) {
        detailsUrls = detailsUrls.filter((_, i) => !data.deletedPhotos.detailsIndexes?.includes(i))
      }
      
      // Upload nouvelle photo face
      if (data.photoFace) {
        faceUrl = await uploadPhoto(data.photoFace, `produits/${productId}/face_${Date.now()}`)
      }
      
      // Upload nouvelle photo dos
      if (data.photoDos) {
        dosUrl = await uploadPhoto(data.photoDos, `produits/${productId}/dos_${Date.now()}`)
      }
      
      // Upload nouvelles photos détails
      for (const file of data.photosDetails) {
        const url = await uploadPhoto(file, `produits/${productId}/detail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
        detailsUrls.push(url)
      }
      
      // Gérer les suppressions de face/dos/faceOnModel
      if (data.deletedPhotos.face) faceUrl = undefined
      if (data.deletedPhotos.dos) dosUrl = undefined
      if (data.deletedPhotos.faceOnModel) faceOnModelUrl = undefined
      
      // Trouver la catégorie avec idsquare
      const catObj = categories.find((c) => c.label === data.categorie)
      
      // Mise à jour Firestore avec dot notation
      const finalSku = data.sku?.trim() || editingProduct.sku || ''
      const updateData: Record<string, any> = {
        nom: finalSku ? `${finalSku} - ${data.nom}` : data.nom,
        sku: finalSku,
        description: data.description || '',
        categorie: catObj || { label: data.categorie },
        prix: parseFloat(data.prix) || 0,
        quantite: parseInt(data.quantite) || 1,
        marque: data.marque || '',
        taille: data.taille || '',
        material: data.material || '',
        color: data.color || '',
        madeIn: data.madeIn || '',
        updatedAt: Timestamp.now(),
      }
      
      // Photos - utiliser dot notation
      if (faceUrl) updateData['photos.face'] = faceUrl
      else updateData['photos.face'] = deleteField()
      
      if (dosUrl) updateData['photos.dos'] = dosUrl
      else updateData['photos.dos'] = deleteField()
      
      if (faceOnModelUrl) updateData['photos.faceOnModel'] = faceOnModelUrl
      else updateData['photos.faceOnModel'] = deleteField()
      
      if (detailsUrls.length > 0) updateData['photos.details'] = detailsUrls
      else updateData['photos.details'] = deleteField()
      
      await updateDoc(doc(db, 'produits', productId), updateData)
      
      setShowForm(false)
      setEditingProduct(null)
      setDirtyIds((prev) => new Set(prev).add(productId))
      alert('Produit mis à jour !')
      
    } catch (err: any) {
      console.error('Erreur sauvegarde:', err)
      alert('Erreur: ' + (err.message || 'Impossible de sauvegarder'))
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
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-[#22209C]">{titre}</h1>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Recherche */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="nom, SKU, marque..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
            />
          </div>

          {/* Filtre chineuse (admin only) */}
          {isAdmin && (
            <select
              value={filtreDeposant}
              onChange={(e) => setFiltreDeposant(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
            >
              <option value="">Toutes chineuses</option>
              {deposantsUniques.map((email, i) => (
                <option key={i} value={email}>{getChineurName(email)}</option>
              ))}
            </select>
          )}

          {/* Filtre catégorie */}
          <select
            value={filtreCategorie}
            onChange={(e) => setFiltreCategorie(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
          >
            <option value="">Toutes catégories</option>
            {categoriesUniques.map((c, i) => (
              <option key={i} value={c as string}>{c}</option>
            ))}
          </select>

          {/* Filtre mois */}
          <select
            value={filtreMois}
            onChange={(e) => setFiltreMois(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
          >
            <option value="">Tous mois</option>
            {moisUniques.map((m) => (
              <option key={m} value={m}>{format(new Date(m + '-01'), 'MMM yyyy', { locale: fr })}</option>
            ))}
          </select>
        </div>

        {/* Compteur et actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-gray-500">
            {produitsFiltres.length} produit(s)
          </span>
          <div className="flex gap-2 flex-wrap">
            {hasActiveFilters && (
              <button onClick={resetFilters} className="text-sm text-[#22209C] flex items-center gap-1 hover:underline">
                <X size={14} /> Reset
              </button>
            )}
            <button onClick={exportToExcel} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-green-700 transition-colors">
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={exportToPDF} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-red-700 transition-colors">
              <Download size={14} /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Barre d'actions : Sync Square + Actions groupées */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Bouton Mettre à jour en caisse */}
        <button
          onClick={handleUpdateSquare}
          disabled={!hasChangesToSync || updatingSquare}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2 hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={16} className={updatingSquare ? 'animate-spin' : ''} />
          {updatingSquare ? 'Sync...' : 'Mettre à jour en caisse'}
        </button>

        {/* Menu actions groupées */}
        {selectedIds.size > 0 && (
          <div className="relative">
            <button
              onClick={() => setMenuOuvert(!menuOuvert)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-blue-700 transition-colors"
            >
              Modifier ({selectedIds.size}) <ChevronDown size={16} />
            </button>
            {menuOuvert && (
              <div className="absolute mt-2 w-56 bg-white shadow-lg rounded-lg border border-gray-200 z-20 overflow-hidden">
                <button
                  onClick={() => {
                    const prix = prompt('Nouveau prix ?')
                    if (prix !== null) {
                      handleBatchUpdate('prix', prix === '' ? '' : parseFloat(prix))
                      setMenuOuvert(false)
                    }
                  }}
                  className="block w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors"
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
                  className="block w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors"
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
                  className="block w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors"
                >
                  Modifier la quantité
                </button>
                <button
                  onClick={() => {
                    setMenuOuvert(false)
                    handleDeleteBulk(Array.from(selectedIds))
                  }}
                  className="block w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 text-sm transition-colors"
                >
                  Supprimer ({selectedIds.size})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sélection globale */}
        <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedIds.size === produitsFiltres.length && produitsFiltres.length > 0}
            onChange={(e) => toggleAll(e.target.checked, produitsFiltres)}
            className="rounded border-gray-300 text-[#22209C] focus:ring-[#22209C]"
          />
          Tout sélectionner ({selectedIds.size}/{produitsFiltres.length})
        </label>
      </div>

      {/* Liste produits - Nouveau Design */}
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
              className={`bg-white rounded-xl border ${isSelected ? 'border-[#22209C] ring-2 ring-[#22209C]/20' : 'border-gray-200'} ${isDirty ? 'border-l-4 border-l-amber-400' : ''} p-4 shadow-sm hover:shadow-md transition-all`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <div className="flex-shrink-0 pt-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(p.id)}
                    className="w-4 h-4 rounded border-gray-300 text-[#22209C] focus:ring-[#22209C]"
                  />
                </div>

                {/* Image */}
                <div className="flex-shrink-0">
                  {allImages.length > 0 ? (
                    <img
                      src={allImages[0]}
                      alt={p.nom}
                      className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(allImages[0], '_blank')}
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 gap-1">
                      <ImageIcon size={24} className="text-green-400" />
                      <span className="text-[10px] leading-tight text-center px-1">
                        {p.sku || p.nom?.substring(0, 10)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Infos principales */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-base">
                    {p.sku && <span className="text-[#22209C]">{p.sku} - </span>}
                    {(p.nom || '').replace(new RegExp(`^${p.sku}\\s*-\\s*`, 'i'), '')}
                  </h3>
                  {p.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-1">
                    {p.createdAt instanceof Timestamp
                      ? format(p.createdAt.toDate(), 'dd/MM/yyyy')
                      : '—'}
                  </p>
                  {isAdmin && (
                    <p className="text-xs text-gray-400 mt-0.5">{getChineurName(p.chineur)}</p>
                  )}
                </div>

                {/* Colonne Taille/Marque/Matière/Couleur - DESKTOP */}
                <div className="hidden md:flex flex-col text-sm text-gray-600 space-y-1 min-w-[140px]">
                  <p><span className="text-gray-400">Taille:</span> <span className="font-medium text-gray-700">{p.taille || '—'}</span></p>
                  <p><span className="text-gray-400">Marque:</span> <span className="font-medium text-gray-700">{p.marque || '—'}</span></p>
                  <p><span className="text-gray-400">Matière:</span> <span className="font-medium text-gray-700">{p.material || '—'}</span></p>
                  <p><span className="text-gray-400">Couleur:</span> <span className="font-medium text-gray-700">{p.color || '—'}</span></p>
                </div>

                {/* Colonne SKU/Prix/Qté - DESKTOP */}
                <div className="hidden sm:flex flex-col items-end text-sm text-gray-600 space-y-1 min-w-[120px]">
                  <p><span className="text-gray-400">SKU:</span> <span className="font-medium text-gray-700">{p.sku || '—'}</span></p>
                  <p><span className="text-gray-400">Prix:</span> <span className="font-medium text-gray-700">{typeof p.prix === 'number' ? `${p.prix} €` : '—'}</span></p>
                  <p><span className="text-gray-400">Qté:</span> <span className="font-medium text-gray-700">{p.quantite ?? 1}</span></p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canGenerateTryon && (
                    <button
                      onClick={() => handleGenerateTryon(p)}
                      disabled={generatingTryonId === p.id}
                      className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg disabled:opacity-50 transition-colors"
                      title="Générer photo portée avec IA"
                    >
                      {generatingTryonId === p.id ? (
                        <span className="text-xs animate-pulse">⏳</span>
                      ) : (
                        <Sparkles size={20} />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleEdit(p)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <MoreHorizontal size={20} />
                  </button>

                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Infos mobile (SKU, Prix, Qté) */}
              <div className="sm:hidden flex gap-4 mt-3 pt-3 border-t border-gray-100 text-sm">
                <span><span className="text-gray-400">SKU:</span> <span className="font-medium">{p.sku || '—'}</span></span>
                <span><span className="text-gray-400">Prix:</span> <span className="font-medium">{typeof p.prix === 'number' ? `${p.prix} €` : '—'}</span></span>
                <span><span className="text-gray-400">Qté:</span> <span className="font-medium">{p.quantite ?? 1}</span></span>
              </div>

              {/* Photos supplémentaires */}
              {allImages.length > 1 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex gap-2 items-center flex-wrap">
                    {displayImages.slice(1).map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`${p.nom} ${idx + 2}`}
                        className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(url, '_blank')}
                      />
                    ))}

                    {hasMoreImages && !isExpanded && (
                      <button
                        onClick={() => toggleExpanded(p.id)}
                        className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-xs font-medium hover:bg-gray-200 transition-colors"
                      >
                        +{allImages.length - 2}
                      </button>
                    )}

                    {isExpanded && allImages.length > 2 && (
                      <button
                        onClick={() => toggleExpanded(p.id)}
                        className="text-xs text-[#22209C] hover:underline flex items-center gap-1"
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
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Aucun produit</p>
        </div>
      )}

      {/* Produits récupérés */}
      {produitsRecuperes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-600">Produits récupérés ({produitsRecuperes.length})</h3>
          <div className="space-y-3">
            {produitsRecuperes.map((p) => {
              const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
              const allImages = getAllImages(p)
              const retourDate =
                p.dateRetour instanceof Timestamp
                  ? p.dateRetour.toDate()
                  : p.dateRetour
                  ? new Date(p.dateRetour as any)
                  : null

              return (
                <div
                  key={p.id}
                  className="bg-white/60 rounded-xl border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    {/* Image */}
                    <div className="flex-shrink-0">
                      {allImages.length > 0 ? (
                        <img src={allImages[0]} alt={p.nom} className="w-20 h-20 object-cover rounded-lg opacity-70" />
                      ) : (
                        <div className="w-20 h-20 bg-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 gap-1">
                          <ImageIcon size={24} className="text-green-400" />
                          <span className="text-[10px] leading-tight text-center px-1">
                            {p.sku || p.nom?.substring(0, 10)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Infos principales */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-700 text-base">
                        {p.sku && <span className="text-gray-500">{p.sku} - </span>}
                        {(p.nom || '').replace(new RegExp(`^${p.sku}\\s*-\\s*`, 'i'), '')}
                      </h3>
                      <p className="text-sm text-amber-600 mt-1">
                        Récupéré le {retourDate ? format(retourDate, 'dd/MM/yyyy') : '—'}
                      </p>
                    </div>

                    {/* Infos droite */}
                    <div className="hidden sm:flex flex-col items-end text-sm text-gray-500 space-y-1 min-w-[120px]">
                      <p><span className="text-gray-400">SKU:</span> <span className="font-medium">{p.sku || '—'}</span></p>
                      <p><span className="text-gray-400">Prix:</span> <span className="font-medium">{typeof p.prix === 'number' ? `${p.prix} €` : '—'}</span></p>
                      <p><span className="text-gray-400">Cat:</span> <span className="font-medium">{cat || '—'}</span></p>
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
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-lg font-semibold text-gray-900">{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</h2>
              <button onClick={() => { setShowForm(false); setEditingProduct(null) }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-4">
              <ProductForm
                mode={editingProduct ? 'edit' : 'create'}
                isAdmin={isAdmin}
                categories={categories}
                sku={editingProduct?.sku}
                initialData={editingProduct ? {
                  nom: (editingProduct.nom || '').replace(new RegExp(`^${editingProduct.sku}\\s*-\\s*`, 'i'), ''),
                  sku: editingProduct.sku,
                  description: editingProduct.description,
                  categorie: typeof editingProduct.categorie === 'object' ? editingProduct.categorie?.label : editingProduct.categorie,
                  prix: editingProduct.prix?.toString(),
                  quantite: editingProduct.quantite?.toString(),
                  marque: editingProduct.marque,
                  taille: editingProduct.taille,
                  material: editingProduct.material,
                  color: editingProduct.color,
                  madeIn: editingProduct.madeIn,
                  photos: editingProduct.photos,
                } : undefined}
                onSubmit={handleSaveProduct}
                onCancel={() => { setShowForm(false); setEditingProduct(null) }}
                showExcelImport={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Supprimer {bulkDeleteIds.length > 0 ? `${bulkDeleteIds.length} produit(s)` : 'ce produit'} ?
            </h3>
            <p className="text-sm text-gray-500 mb-4">Veuillez indiquer la raison de cette suppression :</p>
            <textarea
              value={deleteJustification}
              onChange={(e) => setDeleteJustification(e.target.value)}
              placeholder="Ex: Produit abîmé, erreur de saisie, doublon..."
              className="w-full border border-gray-200 rounded-lg p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
              rows={3}
            />
            
            {deleteProgress && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Suppression en cours...</span>
                  <span>{deleteProgress.current}/{deleteProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-red-600 h-2 rounded-full transition-all" style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }} />
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setBulkDeleteIds([]) }}
                disabled={!!deleteProgress}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={!deleteJustification.trim() || !!deleteProgress}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
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