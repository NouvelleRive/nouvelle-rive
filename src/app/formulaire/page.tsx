// app/formulaire/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import Navbar from '@/components/Navbar'
import ProductForm, { ProductFormData, Cat, ExcelImportData } from '@/components/ProductForm'

// =====================
// HELPERS
// =====================
function toDisplayName(opts: { dataNom?: string; displayName?: string | null; email?: string | null }) {
  const { dataNom, displayName, email } = opts
  const fallbackEmail = email ? email.split('@')[0] : 'Chineur·euse'
  return (dataNom || displayName || fallbackEmail).toUpperCase()
}

function extractSkuNumFromSkuOrName(value: string, tri: string) {
  const v = value?.toString()?.trim() || ''
  const m1 = v.match(new RegExp(`^${tri}(\\d+)$`, 'i'))
  if (m1) return parseInt(m1[1], 10)
  const m2 = v.match(new RegExp(`^${tri}(\\d+)\\s*-`, 'i'))
  if (m2) return parseInt(m2[1], 10)
  return null
}

async function computeNextSkuForTrigram(trigramme: string, userEmail: string): Promise<string> {
  const tri = (trigramme || '').toUpperCase().trim()
  if (!tri || !userEmail) return ''

  const qSnap = await getDocs(
    query(collection(db, 'produits'), where('chineur', '==', userEmail), where('trigramme', '==', tri))
  )

  let maxNum = 0
  qSnap.forEach((d) => {
    const data: any = d.data()
    const trySku = extractSkuNumFromSkuOrName(data?.sku || '', tri)
    const tryName = extractSkuNumFromSkuOrName(data?.nom || '', tri)
    const n = Math.max(trySku ?? 0, tryName ?? 0)
    if (n > maxNum) maxNum = n
  })

  return `${tri}${maxNum + 1}`
}

function readCategorieRapportLabel(data: any) {
  const variants =
    data?.['Catégorie de rapport'] ?? data?.['catégorie de rapport'] ??
    data?.categorieRapport ?? data?.categorie_de_rapport ?? data?.categorie_rapport ?? []

  let label = ''
  if (Array.isArray(variants) && variants.length > 0 && typeof variants[0] === 'object') {
    const v0 = variants[0]
    label = (v0?.label ?? v0?.nom ?? '').toString().trim()
  }
  if (!label && typeof data?.categorieRapportLabel === 'string') label = data.categorieRapportLabel.trim()
  return label
}

// Cloudinary upload
async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('Configuration Cloudinary manquante')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'produits')

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!response.ok) {
    throw new Error('Erreur upload Cloudinary')
  }

  const data = await response.json()
  return data.secure_url
}

// FASHN.ai check
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
export default function FormulairePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [chineurNom, setChineurNom] = useState<string>('CHINEUR·EUSE')
  const [categories, setCategories] = useState<Cat[]>([])
  const [categorieRapport, setCategorieRapport] = useState<string>('')
  const [trigramme, setTrigramme] = useState<string>('')
  const [sku, setSku] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Refresh SKU
  async function refreshSku(tri: string, userEmail: string) {
    if (!tri?.trim() || !userEmail) {
      setSku('')
      return
    }
    try {
      const next = await computeNextSkuForTrigram(tri, userEmail)
      setSku(next)
    } catch (e) {
      console.error('Erreur calcul SKU:', e)
      setSku('')
    }
  }

  // Auth & load data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push('/login')
        return
      }
      setUser(u)

      let chineuseSnap = await getDoc(doc(db, 'chineuse', u.uid))
      if (!chineuseSnap.exists() && u.email) {
        const byEmail = await getDocs(query(collection(db, 'chineuse'), where('email', '==', u.email)))
        if (!byEmail.empty) chineuseSnap = byEmail.docs[0]
      }

      if (!chineuseSnap.exists()) {
        setChineurNom(toDisplayName({ dataNom: undefined, displayName: u.displayName, email: u.email }))
        setCategories([])
        setCategorieRapport('')
        setTrigramme('')
        setSku('')
        return
      }

      const data = chineuseSnap.data() as any
      setChineurNom(toDisplayName({ dataNom: data?.nom, displayName: u.displayName, email: u.email }))

      const triDirect = (data?.trigramme || '').toString().trim().toUpperCase()
      setTrigramme(triDirect)
      setCategorieRapport(readCategorieRapportLabel(data))

      if (u.email) await refreshSku(triDirect, u.email)

      const rawCats = data?.['Catégorie'] ?? []
      const cats: Cat[] = Array.isArray(rawCats)
        ? rawCats
            .map((c: any) => {
              if (!c) return null
              if (typeof c === 'string') return { label: c } as Cat
              const label = (c.label ?? c.value ?? c.nom ?? '').toString().trim()
              if (!label) return null
              return {
                label,
                idsquare: c.idsquare ?? c.idSquare ?? c.squareId ?? c.id ?? undefined,
              } as Cat
            })
            .filter((c: Cat | null): c is Cat => !!c)
        : []

      setCategories(cats)
    })

    return () => unsubscribe()
  }, [router])

  // =====================
  // SUBMIT HANDLER (single product)
  // =====================
  const handleSubmit = async (formData: ProductFormData) => {
    if (!user || !trigramme) return
    
    setLoading(true)
    try {
      const fullName = `${sku} - ${formData.nom.trim()}`

      // Upload photos
      type PhotosStructure = { face?: string; faceOnModel?: string; dos?: string; details: string[] }
      const photos: PhotosStructure = { details: [] }

      if (formData.photoFace) {
        photos.face = await uploadToCloudinary(formData.photoFace)
        
        // Generate try-on if compatible category
        if (canUseFashnAI(formData.categorie)) {
          try {
            const tryonRes = await fetch('/api/generate-tryon', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl: photos.face, productName: fullName })
            })

            if (tryonRes.ok) {
              const tryonData = await tryonRes.json()
              if (tryonData.success && tryonData.onModelUrl) {
                photos.faceOnModel = tryonData.onModelUrl
              }
            }
          } catch (err) {
            console.warn('⚠️ Erreur génération photo portée:', err)
          }
        }
      }

      if (formData.photoDos) {
        photos.dos = await uploadToCloudinary(formData.photoDos)
      }

      if (formData.photosDetails && formData.photosDetails.length > 0) {
        photos.details = await Promise.all(formData.photosDetails.map((file) => uploadToCloudinary(file)))
      }

      // Build imageUrls array
      const imageUrls: string[] = []
      if (photos.face) imageUrls.push(photos.face)
      if (photos.faceOnModel) imageUrls.push(photos.faceOnModel)
      if (photos.dos) imageUrls.push(photos.dos)
      imageUrls.push(...photos.details)

      const photosReady = Boolean(photos.face)

      // Create product in Firebase
      const payload = {
        nom: fullName,
        description: formData.description,
        categorie: formData.categorie,
        prix: parseFloat(formData.prix),
        quantite: parseInt(formData.quantite) || 1,
        marque: formData.marque.trim(),
        taille: formData.taille.trim(),
        material: formData.material.trim() || null,
        color: formData.color.trim() || null,
        madeIn: formData.madeIn || null,
        sku,
        chineur: user.email,
        chineurUid: user.uid,
        categorieRapport,
        trigramme,
        photos,
        imageUrls,
        imageUrl: imageUrls[0] || '',
        photosReady,
        vendu: false,
        createdAt: serverTimestamp(),
      }

      const docRef = await addDoc(collection(db, 'produits'), payload)

      // Send to Square if ready
      const match = categories.find((c) => c?.label === formData.categorie)
      const idsquare = match?.idsquare

      if (idsquare && photosReady) {
        try {
          const res = await fetch('/api/import-square-produits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nom: fullName,
              productId: docRef.id,
              prix: parseFloat(formData.prix),
              description: formData.description,
              sku,
              categorie: idsquare,
              chineurNom: user.uid,
              chineurEmail: user.email,
              trigramme,
              stock: parseInt(formData.quantite) || 1,
              marque: formData.marque.trim(),
              taille: formData.taille.trim(),
              imageUrl: imageUrls[0] || '',
              imageUrls,
            }),
          })

          const raw = await res.text()
          let data: any = {}
          try { data = JSON.parse(raw) } catch {}

          if (res.ok && data?.success) {
            const update: Record<string, any> = {}
            if (data.catalogObjectId) update.catalogObjectId = data.catalogObjectId
            if (data.variationId) update.variationId = data.variationId
            if (data.itemId) update.itemId = data.itemId
            if (data.imageId) update.imageId = data.imageId

            if (Object.keys(update).length > 0) {
              await updateDoc(doc(db, 'produits', docRef.id), update)
            }
          }
        } catch (sqErr) {
          console.error('Erreur Square :', sqErr)
        }
      }

      alert('✅ Produit ajouté avec succès !')

      // Refresh SKU for next product
      if (user.email) {
        await refreshSku(trigramme, user.email)
      }
    } catch (err: any) {
      console.error('💥 ERREUR:', err)
      alert('Erreur : ' + (err?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  // =====================
  // EXCEL IMPORT HANDLER
  // =====================
  const handleExcelImport = async (produits: ExcelImportData[]) => {
    if (!user || !trigramme) return
    
    try {
      // Calculer le prochain SKU
      let currentSkuNum = extractSkuNumFromSkuOrName(sku, trigramme) || 0
      
      let successCount = 0
      
      for (const produit of produits) {
        // Générer le SKU si pas fourni
        let rowSku = produit.sku
        if (!rowSku) {
          currentSkuNum++
          rowSku = `${trigramme}${currentSkuNum}`
        }
        
        const fullName = `${rowSku} - ${produit.nom}`
        
        // Créer le produit dans Firebase
        const payload = {
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
          chineur: user.email,
          chineurUid: user.uid,
          categorieRapport,
          trigramme,
          imageUrls: [],
          vendu: false,
          createdAt: serverTimestamp(),
        }
        
        const docRef = await addDoc(collection(db, 'produits'), payload)
        
        // Sync Square si catégorie a un idsquare
        const match = categories.find((c) => c?.label === produit.categorie)
        if (match?.idsquare) {
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
                categorie: match.idsquare,
                chineurNom: user.uid,
                chineurEmail: user.email,
                trigramme,
                stock: produit.quantite || 1,
                marque: produit.marque || '',
                taille: produit.taille || '',
                imageUrl: '',
                imageUrls: [],
              }),
            })
            
            const raw = await res.text()
            let data: any = {}
            try { data = JSON.parse(raw) } catch {}
            
            if (res.ok && data?.success) {
              const update: Record<string, any> = {}
              if (data.catalogObjectId) update.catalogObjectId = data.catalogObjectId
              if (data.variationId) update.variationId = data.variationId
              if (data.itemId) update.itemId = data.itemId
              if (Object.keys(update).length > 0) {
                await updateDoc(doc(db, 'produits', docRef.id), update)
              }
            }
          } catch {}
        }
        
        successCount++
      }
      
      alert(`✅ ${successCount} produit(s) importé(s) avec succès !`)
      
      // Refresh SKU
      if (user.email) {
        await refreshSku(trigramme, user.email)
      }
      
    } catch (err: any) {
      console.error('Erreur import:', err)
      alert('❌ Erreur import : ' + (err?.message || ''))
    }
  }

  // =====================
  // RENDER
  // =====================
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="mb-4">
          <p className="text-sm text-gray-500">Hello {chineurNom} 👋</p>
          <h1 className="text-xl font-bold text-[#22209C]">AJOUTER UN PRODUIT</h1>
        </div>

        {/* Product Form avec import Excel intégré */}
        <ProductForm
          mode="create"
          isAdmin={false}
          categories={categories}
          sku={sku}
          userName={chineurNom}
          trigramme={trigramme}
          onSubmit={handleSubmit}
          onExcelImport={handleExcelImport}
          loading={loading}
          showExcelImport={true}
        />

        {!trigramme?.trim() && (
          <p className="text-xs text-red-600 text-center mt-4">
            ⚠️ Trigramme absent — contactez NOUVELLE RIVE
          </p>
        )}
      </main>
    </>
  )
}