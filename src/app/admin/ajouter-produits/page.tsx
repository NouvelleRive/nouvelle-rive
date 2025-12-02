// app/admin/ajouter/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, getDocs, query, where, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { AdminProvider, useAdmin } from '@/lib/admin/context'
import ProductForm, { ProductFormData, ExcelImportData } from '@/components/ProductForm'
import { 
  uploadToCloudinary, 
  canUseFashnAI, 
  computeNextSkuForTrigram, 
  readCategorieRapportLabel,
  extractSkuNumFromSkuOrName 
} from '@/lib/admin/helpers'

type Cat = { label: string; idsquare?: string }

export default function AdminAjouterPage() {
  const { 
    selectedChineuse, 
    deposants,
    loading,
    loadData,
    autoSku,
    setAutoSku
  } = useAdmin()

  const [creatingProduct, setCreatingProduct] = useState(false)

  // Convertir les catégories de la chineuse pour ProductForm
  const chineuseCategories = useMemo(() => {
    if (!selectedChineuse) return []
    const deposant = deposants.find((d: any) => d.id === selectedChineuse.uid)
    const rawCats = deposant?.['Catégorie'] ?? []
    return Array.isArray(rawCats)
      ? rawCats.map((c: any) => {
          if (!c) return null
          if (typeof c === 'string') return { label: c }
          const label = (c.label ?? c.value ?? c.nom ?? '').toString().trim()
          if (!label) return null
          return { label, idsquare: c.idsquare ?? c.idSquare ?? c.squareId ?? c.id ?? undefined }
        }).filter((c): c is Cat => !!c)
      : []
  }, [selectedChineuse, deposants])

  // Création produit
  const handleCreateProduit = async (data: ProductFormData) => {
    if (!selectedChineuse?.trigramme) { alert('Chineuse manquante'); return }
    
    // Utiliser le SKU forcé ou l'auto-SKU
    const finalSku = data.sku?.trim() || autoSku
    if (!finalSku) { alert('SKU manquant'); return }
    
    setCreatingProduct(true)
    try {
      const fullName = `${finalSku} - ${data.nom.trim()}`
      const deposantOriginal = deposants.find((d: any) => d.id === selectedChineuse.uid)
      const categorieRapport = readCategorieRapportLabel(deposantOriginal)

      type PhotosStructure = { face?: string; faceOnModel?: string; dos?: string; details: string[] }
      const photos: PhotosStructure = { details: [] }
      const imageUrls: string[] = []

      if (data.photoFace) {
        photos.face = await uploadToCloudinary(data.photoFace)
        imageUrls.push(photos.face)
        if (canUseFashnAI(data.categorie)) {
          try {
            const tryonRes = await fetch('/api/generate-tryon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: photos.face, productName: fullName }) })
            if (tryonRes.ok) {
              const tryonData = await tryonRes.json()
              if (tryonData.success && tryonData.onModelUrl) { photos.faceOnModel = tryonData.onModelUrl; imageUrls.push(photos.faceOnModel) }
            }
          } catch {}
        }
      }
      if (data.photoDos) { photos.dos = await uploadToCloudinary(data.photoDos); imageUrls.push(photos.dos) }
      if (data.photosDetails.length > 0) { photos.details = await Promise.all(data.photosDetails.map((f) => uploadToCloudinary(f))); imageUrls.push(...photos.details) }

      const payload: any = {
        nom: fullName, description: data.description, categorie: data.categorie,
        prix: parseFloat(data.prix), quantite: parseInt(data.quantite),
        marque: data.marque.trim(), taille: data.taille.trim(),
        material: data.material.trim() || null, color: data.color.trim() || null,
        madeIn: data.madeIn || null, sku: finalSku,
        chineurUid: selectedChineuse.uid, categorieRapport,
        trigramme: selectedChineuse.trigramme, photos, imageUrls,
        imageUrl: imageUrls[0] || '', photosReady: Boolean(photos.face),
        vendu: false, createdAt: serverTimestamp(),
      }
      if (selectedChineuse.email) payload.chineur = selectedChineuse.email

      const docRef = await addDoc(collection(db, 'produits'), payload)

      const match = chineuseCategories.find((c) => c?.label === data.categorie)
      if (match?.idsquare && photos.face) {
        try {
          const res = await fetch('/api/import-square-produits', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              nom: fullName, productId: docRef.id, prix: parseFloat(data.prix), 
              description: data.description, sku: finalSku, categorie: match.idsquare, 
              chineurNom: selectedChineuse.uid, chineurEmail: selectedChineuse.email, 
              trigramme: selectedChineuse.trigramme, stock: parseInt(data.quantite) || 1, 
              marque: data.marque.trim(), taille: data.taille.trim(), 
              imageUrl: imageUrls[0] || '', imageUrls 
            }) 
          })
          const raw = await res.text()
          let resData: any = {}; try { resData = JSON.parse(raw) } catch {}
          if (res.ok && resData?.success) {
            const update: Record<string, any> = {}
            if (resData.catalogObjectId) update.catalogObjectId = resData.catalogObjectId
            if (resData.variationId) update.variationId = resData.variationId
            if (resData.itemId) update.itemId = resData.itemId
            if (resData.imageId) update.imageId = resData.imageId
            if (Object.keys(update).length > 0) await updateDoc(doc(db, 'produits', docRef.id), update)
          }
        } catch {}
      }

      alert('Produit créé !')
      const identifier = selectedChineuse.email || selectedChineuse.uid
      const nextSku = await computeNextSkuForTrigram(selectedChineuse.trigramme, identifier, !selectedChineuse.email)
      setAutoSku(nextSku)
      await loadData()
    } catch (error) { alert('Erreur : ' + (error as any)?.message) }
    finally { setCreatingProduct(false) }
  }

  // Import Excel
  const handleExcelImportFromForm = async (produits: ExcelImportData[]) => {
    if (!selectedChineuse) return
    
    try {
      const tri = selectedChineuse.trigramme?.toUpperCase().trim()
      if (!tri) { alert('Trigramme manquant'); return }
      
      // Calculer le prochain SKU
      let currentSkuNum = 0
      const identifier = selectedChineuse.email || selectedChineuse.uid
      const fieldName = selectedChineuse.email ? 'chineur' : 'chineurUid'
      const qSnap = await getDocs(query(collection(db, 'produits'), where(fieldName, '==', identifier), where('trigramme', '==', tri)))
      qSnap.forEach((d) => { 
        const docData: any = d.data()
        const n = Math.max(extractSkuNumFromSkuOrName(docData?.sku || '', tri) ?? 0, extractSkuNumFromSkuOrName(docData?.nom || '', tri) ?? 0)
        if (n > currentSkuNum) currentSkuNum = n 
      })
      
      const deposantOriginal = deposants.find((d: any) => d.id === selectedChineuse.uid)
      const categorieRapport = readCategorieRapportLabel(deposantOriginal)
      
      let successCount = 0
      
      for (const produit of produits) {
        // Générer le SKU
        let rowSku = produit.sku
        if (!rowSku) {
          currentSkuNum++
          rowSku = `${tri}${currentSkuNum}`
        }
        
        const fullName = `${rowSku} - ${produit.nom}`
        
        // Créer le produit
        const payload: any = {
          nom: fullName,
          description: produit.description || '',
          categorie: produit.categorie,
          prix: produit.prix,
          quantite: produit.quantite || 1,
          marque: produit.marque || '',
          taille: produit.taille || '',
          material: produit.material || null,
          color: produit.color || null,
          madeIn: produit.madeIn || null,
          sku: rowSku,
          chineurUid: selectedChineuse.uid,
          categorieRapport,
          trigramme: tri,
          imageUrls: [],
          vendu: false,
          createdAt: serverTimestamp(),
        }
        if (selectedChineuse.email) payload.chineur = selectedChineuse.email
        
        const docRef = await addDoc(collection(db, 'produits'), payload)
        
        // Sync Square si catégorie a un idsquare
        const catMatch = chineuseCategories.find((c) => c.label === produit.categorie)
        if (catMatch?.idsquare) {
          try {
            const res = await fetch('/api/import-square-produits', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nom: fullName,
                productId: docRef.id,
                prix: produit.prix,
                description: produit.description || '',
                sku: rowSku,
                categorie: catMatch.idsquare,
                chineurNom: selectedChineuse.uid,
                chineurEmail: selectedChineuse.email,
                trigramme: tri,
                stock: produit.quantite || 1,
                marque: produit.marque || '',
                taille: produit.taille || '',
                imageUrl: '',
                imageUrls: [],
              }),
            })
            const raw = await res.text()
            let resData: any = {}
            try { resData = JSON.parse(raw) } catch {}
            if (res.ok && resData?.success) {
              const update: Record<string, any> = {}
              if (resData.catalogObjectId) update.catalogObjectId = resData.catalogObjectId
              if (resData.variationId) update.variationId = resData.variationId
              if (resData.itemId) update.itemId = resData.itemId
              if (Object.keys(update).length > 0) await updateDoc(doc(db, 'produits', docRef.id), update)
            }
          } catch {}
        }
        
        successCount++
      }
      
      alert(`✅ ${successCount} produit(s) importé(s) !`)
      await loadData()
      
      // Refresh SKU
      const nextSku = await computeNextSkuForTrigram(tri, identifier, !selectedChineuse.email)
      setAutoSku(nextSku)
      
    } catch (error: any) {
      alert('❌ Erreur import : ' + (error?.message || ''))
    }
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
      {!selectedChineuse && (
        <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-6">
          <p className="text-amber-800">Sélectionnez une chineuse dans "Je suis" pour créer des produits.</p>
        </div>
      )}
      
      {selectedChineuse && (
        <div className="bg-white rounded border p-6">
          {autoSku && <p className="text-sm text-green-600 mb-4">Prochain SKU suggéré : <strong>{autoSku}</strong> <span className="text-gray-400">(modifiable)</span></p>}
          <ProductForm 
            mode="create" 
            isAdmin={true}
            categories={chineuseCategories} 
            sku={autoSku} 
            userName={selectedChineuse.nom || selectedChineuse.email}
            trigramme={selectedChineuse.trigramme}
            onSubmit={handleCreateProduit} 
            onExcelImport={handleExcelImportFromForm}
            loading={creatingProduct}
            showExcelImport={true}
          />
        </div>
      )}
    </>
  )
}