// app/admin/produits/page.tsx
'use client'

import { useState, useMemo } from 'react'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { useAdmin } from '@/lib/admin/context'
import ProductList from '@/components/ProductList'
import ProductForm from '@/components/ProductForm'
import { X } from 'lucide-react'
import { uploadToCloudinary, canUseFashnAI } from '@/lib/admin/helpers'

export default function AdminProduitsPage() {
  const { 
    selectedChineuse, 
    produitsFiltres, 
    deposants,
    loading,
    loadData 
  } = useAdmin()

  // Modal édition
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [editingLoading, setEditingLoading] = useState(false)

  // Modal suppression
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState<'erreur' | 'produit_recupere' | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Génération IA
  const [generatingTryonId, setGeneratingTryonId] = useState<string | null>(null)

  // Catégories uniques
  const categoriesUniques = useMemo(() => {
    return Array.from(new Set(
      produitsFiltres.map((p) => (typeof p.categorie === 'object' ? p.categorie?.label : p.categorie)).filter(Boolean)
    )) as string[]
  }, [produitsFiltres])

  // Suppression
  const handleDeleteProduit = async () => {
    if (!confirmDeleteId || !deleteReason) return
    setDeleting(true)
    try {
      const res = await fetch('/api/delete-produits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <ProductList
        produits={produitsFiltres}
        categories={categoriesUniques}
        deposants={deposants}
        isAdmin={!selectedChineuse}
        showVentes={false}
        showFilters={true}
        showExport={true}
        showSelection={false}
        showActions={true}
        onEdit={(p) => setEditingProduct(p)}
        onDelete={(id) => { setConfirmDeleteId(id); setDeleteReason(null) }}
        onGenerateTryon={handleGenerateTryon}
        generatingTryonId={generatingTryonId}
      />

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

      {/* Modal Suppression */}
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
    </>
  )
}