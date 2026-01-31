// app/admin/ajouter-produits/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, getDocs, query, where, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { AdminProvider, useAdmin } from '@/lib/admin/context'
import ProductForm, { ProductFormData, ExcelImportData } from '@/components/ProductForm'
import { 
  computeNextSkuForTrigram, 
  readCategorieRapportLabel,
  extractSkuNumFromSkuOrName, 
  checkSkuUnique
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

      // ✅ VÉRIFICATION UNICITÉ SKU
        const isUnique = await checkSkuUnique(finalSku)
        if (!isUnique) {
          alert(`❌ Le SKU "${finalSku}" est déjà utilisé par un autre produit.`)
          setCreatingProduct(false)
          return
        }

      const deposantOriginal = deposants.find((d: any) => d.id === selectedChineuse.uid)
      const categorieRapport = readCategorieRapportLabel(deposantOriginal)

      // Photos déjà traitées par PhotoEditor
      const imageUrls: string[] = []
      if (data.existingPhotos.face) imageUrls.push(data.existingPhotos.face)
      if (data.existingPhotos.dos) imageUrls.push(data.existingPhotos.dos)
      if (data.existingPhotos.details) imageUrls.push(...data.existingPhotos.details)

      const payload: any = {
        nom: fullName, description: data.description, categorie: data.categorie,
        prix: parseFloat(data.prix), quantite: parseInt(data.quantite),
        marque: data.marque.trim(), taille: data.taille.trim(),
        material: data.material.trim() || null, color: data.color.trim() || null,
        madeIn: data.madeIn || null, sku: finalSku,
        chineurUid: selectedChineuse.uid, categorieRapport,
        trigramme: selectedChineuse.trigramme, 
        ...(Object.keys(data.existingPhotos).length > 0 && {
          photos: {
            ...(data.existingPhotos.face && { face: data.existingPhotos.face }),
            ...(data.existingPhotos.dos && { dos: data.existingPhotos.dos }),
            ...(data.existingPhotos.details?.length && { details: data.existingPhotos.details }),
          },
        }),
        imageUrls,
        imageUrl: imageUrls[0] || '', photosReady: Boolean(data.existingPhotos.face),
        vendu: false, createdAt: serverTimestamp(),
        recu: false,
      }
      if (selectedChineuse.email) payload.chineur = selectedChineuse.email

      const docRef = await addDoc(collection(db, 'produits'), payload)

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

        // ✅ VÉRIFICATION UNICITÉ SKU
        const isUnique = await checkSkuUnique(rowSku)
        if (!isUnique) {
          console.warn(`SKU "${rowSku}" existe déjà, ignoré`)
          continue
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
          recu: false,
          createdAt: serverTimestamp(),
        }
        if (selectedChineuse.email) payload.chineur = selectedChineuse.email
        
        const docRef = await addDoc(collection(db, 'produits'), payload)
        
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
          <ProductForm 
            key={autoSku}
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