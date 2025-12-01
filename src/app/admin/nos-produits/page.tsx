// app/admin/nos-produits/page.tsx
'use client'

import { useState, useMemo } from 'react'
import { updateDoc, doc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebaseConfig'
import { useAdmin } from '@/lib/admin/context'
import ProductList from '@/components/ProductList'
import ProductForm from '@/components/ProductForm'
import { X, Trash2, CheckSquare, Square } from 'lucide-react'
import { uploadToCloudinary, canUseFashnAI } from '@/lib/admin/helpers'

// Helper pour récupérer le token
const getAuthToken = async () => {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}

export default function AdminProduitsPage() {
  const { 
    selectedChineuse, 
    produitsFiltres, 
    deposants,
    loading,
    loadData 
  } = useAdmin()

  // Sélection groupée
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)

  // Modal édition
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [editingLoading, setEditingLoading] = useState(false)

  // Modal suppression
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState<'erreur' | 'produit_recupere' | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Modal suppression groupée
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [bulkDeleteReason, setBulkDeleteReason] = useState<'erreur' | 'produit_recupere' | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Génération IA
  const [generatingTryonId, setGeneratingTryonId] = useState<string | null>(null)

  // Produits actifs (non vendus, non supprimés)
  const produitsActifs = useMemo(() => {
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

  // Sélection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(produitsActifs.map(p => p.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds(new Set())
    }
    setSelectionMode(!selectionMode)
  }

  // Suppression unique
  const handleDeleteProduit = async () => {
    if (!confirmDeleteId || !deleteReason) return
    setDeleting(true)
    try {
      const token = await getAuthToken()
      if (!token) {
        alert('Non authentifié')
        return
      }
      const res = await fetch('/api/delete-produits', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId: confirmDeleteId, reason: deleteReason }),
      })
      if (res.ok) {
        setConfirmDeleteId(null)
        setDeleteReason(null)
        await loadData()
        alert('Produit supprimé')
      } else throw new Error('Erreur API')
    } catch { alert('Erreur suppression') }
    finally { setDeleting(false) }
  }

  // Suppression groupée (optimisée batch)
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !bulkDeleteReason) return
    setBulkDeleting(true)
    
    try {
      const token = await getAuthToken()
      if (!token) {
        alert('Non authentifié')
        return
      }

      const res = await fetch('/api/delete-produits-batch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          productIds: Array.from(selectedIds), 
          reason: bulkDeleteReason 
        }),
      })

      const data = await res.json()

      setShowBulkDeleteModal(false)
      setBulkDeleteReason(null)
      setSelectedIds(new Set())
      setSelectionMode(false)
      await loadData()
      
      if (res.ok) {
        alert(`${data.count} produit(s) supprimé(s)`)
      } else {
        alert(data.error || 'Erreur suppression')
      }
    } catch {
      alert('Erreur suppression groupée')
    } finally {
      setBulkDeleting(false)
    }
  }

  // Générer photo portée
  const handleGenerateTryon = async (p: any) => {
    const faceUrl = p.photos?.face || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : p.imageUrl)
    if (!faceUrl) { alert('Pas de photo de face disponible'); return }

    setGeneratingTryonId(p.id)
    try {
      const res = await fetch('/api/generate-tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: faceUrl, productName: p.nom })
      })
      if (!res.ok) throw new Error('Erreur API')
      const data = await res.json()
      if (data.success && data.onModelUrl) {
        const updatedPhotos = { ...(p.photos || { details: [] }), face: faceUrl, faceOnModel: data.onModelUrl }
        const newImageUrls = [faceUrl, data.onModelUrl, ...(p.photos?.dos ? [p.photos.dos] : []), ...(p.photos?.details || [])]
        await updateDoc(doc(db, 'produits', p.id), { photos: updatedPhotos, imageUrls: newImageUrls, imageUrl: faceUrl, photosReady: true })
        await loadData()
        alert('✅ Photo portée générée !')
      } else throw new Error(data.error || 'Erreur')
    } catch (err: any) { alert('❌ Erreur : ' + (err?.message || 'Impossible de générer')) }
    finally { setGeneratingTryonId(null) }
  }

  // Édition
  const getInitialDataForEdit = (p: any) => ({
    nom: p.nom?.replace(/^[A-Z]{2,4}\d+\s*-\s*/, '') || '',
    description: p.description || '',
    categorie: typeof p.categorie === 'object' ? p.categorie?.label : p.categorie || '',
    prix: p.prix?.toString() || '',
    quantite: p.quantite?.toString() || '1',
    marque: p.marque || '',
    taille: p.taille || '',
    material: p.material || '',
    color: p.color || '',
    madeIn: p.madeIn || '',
    photos: p.photos || { face: p.imageUrls?.[0], details: p.imageUrls?.slice(1) || [] },
  })

  const handleEditProduit = async (data: any) => {
    if (!editingProduct) return
    setEditingLoading(true)
    try {
      let newFaceUrl = data.deletedPhotos?.face ? undefined : data.existingPhotos?.face
      let newFaceOnModelUrl = data.deletedPhotos?.faceOnModel ? undefined : data.existingPhotos?.faceOnModel
      let newDosUrl = data.deletedPhotos?.dos ? undefined : data.existingPhotos?.dos
      let newDetails = (data.existingPhotos?.details || []).filter((_: any, i: number) => !data.deletedPhotos?.detailsIndexes?.includes(i))

      if (data.photoFace) {
        newFaceUrl = await uploadToCloudinary(data.photoFace)
        if (canUseFashnAI(data.categorie)) {
          try {
            const tryonRes = await fetch('/api/generate-tryon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: newFaceUrl, productName: editingProduct.nom }) })
            if (tryonRes.ok) { const tryonData = await tryonRes.json(); if (tryonData.success && tryonData.onModelUrl) newFaceOnModelUrl = tryonData.onModelUrl }
          } catch {}
        }
      }
      if (data.photoDos) newDosUrl = await uploadToCloudinary(data.photoDos)
      if (data.photosDetails?.length > 0) { const uploaded = await Promise.all(data.photosDetails.map((f: File) => uploadToCloudinary(f))); newDetails = [...newDetails, ...uploaded] }

      const photos = { face: newFaceUrl, faceOnModel: newFaceOnModelUrl, dos: newDosUrl, details: newDetails }
      const imageUrls: string[] = []
      if (photos.face) imageUrls.push(photos.face)
      if (photos.faceOnModel) imageUrls.push(photos.faceOnModel)
      if (photos.dos) imageUrls.push(photos.dos)
      imageUrls.push(...(photos.details || []))

      await updateDoc(doc(db, 'produits', editingProduct.id), {
        nom: `${editingProduct.sku} - ${data.nom}`,
        description: data.description, categorie: data.categorie,
        prix: parseFloat(data.prix), quantite: parseInt(data.quantite),
        marque: data.marque?.trim(), taille: data.taille?.trim(),
        material: data.material?.trim() || null, color: data.color?.trim() || null,
        madeIn: data.madeIn || null, photos, imageUrls,
        imageUrl: imageUrls[0] || '', photosReady: Boolean(photos.face),
      })

      alert('Produit modifié !')
      setEditingProduct(null)
      await loadData()
    } catch (error) { alert('Erreur : ' + (error as any)?.message) }
    finally { setEditingLoading(false) }
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
      {/* Barre de sélection */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSelectionMode}
            className={`flex items-center gap-2 px-4 py-2 rounded border ${
              selectionMode ? 'bg-[#22209C] text-white' : 'bg-white text-gray-700'
            }`}
          >
            {selectionMode ? <CheckSquare size={18} /> : <Square size={18} />}
            {selectionMode ? 'Mode sélection ON' : 'Sélection multiple'}
          </button>

          {selectionMode && (
            <>
              <button
                onClick={selectAll}
                className="text-sm text-[#22209C] hover:underline"
              >
                Tout sélectionner ({produitsActifs.length})
              </button>
              <button
                onClick={deselectAll}
                className="text-sm text-gray-500 hover:underline"
              >
                Désélectionner
              </button>
            </>
          )}
        </div>

        {selectionMode && selectedIds.size > 0 && (
          <button
            onClick={() => setShowBulkDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            <Trash2 size={18} />
            Supprimer ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Liste produits avec sélection */}
      <div className="space-y-3">
        {produitsActifs.map((p) => {
          const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
          const allImages = (() => {
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
          })()

          const isSelected = selectedIds.has(p.id)

          return (
            <div
              key={p.id}
              className={`border rounded-lg p-3 shadow-sm bg-white flex gap-4 items-start ${
                isSelected ? 'ring-2 ring-[#22209C] bg-blue-50' : ''
              }`}
            >
              {/* Checkbox */}
              {selectionMode && (
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(p.id)}
                    className="w-5 h-5 rounded border-gray-300 text-[#22209C] focus:ring-[#22209C]"
                  />
                </div>
              )}

              {/* Photo */}
              <div className="w-16 h-16 flex-shrink-0">
                {allImages.length > 0 ? (
                  <img
                    src={allImages[0]}
                    alt={p.nom}
                    className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                    onClick={() => window.open(allImages[0], '_blank')}
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                    Ø
                  </div>
                )}
              </div>

              {/* Nom / Description / Date */}
              <div className="flex-1 min-w-[180px]">
                <p className="font-semibold text-sm">{p.nom}</p>
                {p.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {p.createdAt && typeof p.createdAt.toDate === 'function'
                    ? new Date(p.createdAt.toDate()).toLocaleDateString('fr-FR')
                    : '—'}
                </p>
              </div>

              {/* Catégorie / Marque / Taille */}
              <div className="w-32 text-xs space-y-1 hidden md:block">
                <p><span className="text-gray-500">Cat:</span> {cat ?? '—'}</p>
                <p><span className="text-gray-500">Marque:</span> {p.marque ?? '—'}</p>
                <p><span className="text-gray-500">Taille:</span> {p.taille ?? '—'}</p>
              </div>

              {/* SKU / Prix / Quantité */}
              <div className="w-28 text-xs space-y-1">
                <p><span className="text-gray-500">SKU:</span> {p.sku ?? '—'}</p>
                <p><span className="text-gray-500">Prix:</span> {typeof p.prix === 'number' ? `${p.prix} €` : '—'}</p>
                <p><span className="text-gray-500">Qté:</span> {p.quantite ?? 1}</p>
              </div>

              {/* Actions */}
              {!selectionMode && (
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingProduct(p)}
                    className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded"
                    title="Modifier"
                  >
                    <span className="text-lg">⋯</span>
                  </button>
                  <button
                    onClick={() => { setConfirmDeleteId(p.id); setDeleteReason(null) }}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {produitsActifs.length === 0 && (
        <p className="text-center text-gray-400 py-8">Aucun produit</p>
      )}

      {/* Modal Édition */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Modifier : {editingProduct.sku}</h2>
              <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-gray-100 rounded"><X size={20} /></button>
            </div>
            <div className="p-6">
              <ProductForm 
                mode="edit" 
                isAdmin={false} 
                categories={categoriesUniques.map(c => ({ label: c }))} 
                sku={editingProduct.sku || ''} 
                initialData={getInitialDataForEdit(editingProduct)} 
                onSubmit={handleEditProduit} 
                onCancel={() => setEditingProduct(null)} 
                loading={editingLoading} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Suppression unique */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-semibold mb-3">Pourquoi retirer cet article ?</h3>
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2">
                <input type="radio" name="justif" checked={deleteReason === 'erreur'} onChange={() => setDeleteReason('erreur')} />
                <span>Erreur</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="justif" checked={deleteReason === 'produit_recupere'} onChange={() => setDeleteReason('produit_recupere')} />
                <span>Produit récupéré</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setConfirmDeleteId(null); setDeleteReason(null) }} className="px-4 py-2 border rounded">Annuler</button>
              <button onClick={handleDeleteProduit} disabled={!deleteReason || deleting} className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50">{deleting ? '...' : 'Confirmer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Suppression groupée */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-semibold mb-3">Supprimer {selectedIds.size} produit(s) ?</h3>
            <p className="text-sm text-gray-600 mb-4">Cette action est irréversible.</p>
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2">
                <input type="radio" name="bulkJustif" checked={bulkDeleteReason === 'erreur'} onChange={() => setBulkDeleteReason('erreur')} />
                <span>Erreur</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="bulkJustif" checked={bulkDeleteReason === 'produit_recupere'} onChange={() => setBulkDeleteReason('produit_recupere')} />
                <span>Produits récupérés</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => { setShowBulkDeleteModal(false); setBulkDeleteReason(null) }} 
                className="px-4 py-2 border rounded"
              >
                Annuler
              </button>
              <button 
                onClick={handleBulkDelete} 
                disabled={!bulkDeleteReason || bulkDeleting} 
                className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
              >
                {bulkDeleting ? 'Suppression...' : `Supprimer ${selectedIds.size} produit(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}