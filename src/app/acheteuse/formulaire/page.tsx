// app/acheteuse/formulaire/page.tsx
// Ajout d'une pièce achat par l'acheteuse. Même flux que la chineuse mais rattaché
// au trigramme dédié ACH (doc chineuse `nouvelle-rive-achats`). La saisie du prix
// d'achat + marge est gérée dans ProductForm (Brique 2).
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { setDoc, serverTimestamp, getDoc, doc, getDocs, collection, query, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import ProductForm, { ProductFormData, Cat, ExcelImportData } from '@/components/ProductForm'
import ImportMailModal, { type ItemFields } from '@/modules/achat/ImportMailModal'
import AchatPreviewSection from '@/modules/achat/AchatPreviewSection'
import { ACHETEUSE_CHINEUSE_DOC, ACHETEUSE_TRIGRAMME, ACHETEUSE_EMAIL } from '@/lib/roles'

// =====================
// HELPERS (calcul SKU par trigramme — identique à l'espace chineuse)
// =====================
function extractSkuNumFromSkuOrName(value: string, tri: string) {
  const v = value?.toString()?.trim() || ''
  const m1 = v.match(new RegExp(`^${tri}(\\d+)$`, 'i'))
  if (m1) return parseInt(m1[1], 10)
  const m2 = v.match(new RegExp(`^${tri}(\\d+)\\s*-`, 'i'))
  if (m2) return parseInt(m2[1], 10)
  return null
}

async function computeNextSkuForTrigram(trigramme: string): Promise<string> {
  const tri = (trigramme || '').toUpperCase().trim()
  if (!tri) return ''
  const qSnap = await getDocs(query(collection(db, 'produits'), where('trigramme', '==', tri)))
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

// =====================
// COMPONENT
// =====================
export default function AcheteuseFormulairePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [categories, setCategories] = useState<Cat[]>([])
  const [categorieRapport, setCategorieRapport] = useState<string>('')
  const [sku, setSku] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [vintedModalOpen, setVintedModalOpen] = useState(false)
  const [pendingPreview, setPendingPreview] = useState<ItemFields[] | null>(null)

  const trigramme = ACHETEUSE_TRIGRAMME
  const targetChineuse = { uid: ACHETEUSE_CHINEUSE_DOC, email: ACHETEUSE_EMAIL, trigramme: ACHETEUSE_TRIGRAMME }

  async function refreshSku() {
    try {
      setSku(await computeNextSkuForTrigram(trigramme))
    } catch (e) {
      console.error('Erreur calcul SKU:', e)
      setSku('')
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/login'); return }
      setUser(u)

      const snap = await getDoc(doc(db, 'chineuse', ACHETEUSE_CHINEUSE_DOC))
      const data = (snap.exists() ? snap.data() : {}) as any
      setCategorieRapport(readCategorieRapportLabel(data))

      const rawCats = data?.['Catégorie'] ?? []
      const cats: Cat[] = Array.isArray(rawCats)
        ? rawCats
            .map((c: any) => {
              if (!c) return null
              if (typeof c === 'string') return { label: c } as Cat
              const label = (c.label ?? c.value ?? c.nom ?? '').toString().trim()
              if (!label) return null
              return { label, idsquare: c.idsquare ?? c.idSquare ?? c.squareId ?? c.id ?? undefined } as Cat
            })
            .filter((c: Cat | null): c is Cat => !!c)
        : []
      setCategories(cats)

      await refreshSku()
    })
    return () => unsubscribe()
  }, [router])

  const handleSubmit = async (formData: ProductFormData) => {
    if (!user) return
    setLoading(true)
    try {
      const existingDoc = await getDoc(doc(db, 'produits', sku))
      if (existingDoc.exists()) {
        alert(`❌ Le SKU "${sku}" est déjà utilisé par un autre produit.`)
        setLoading(false)
        return
      }
      const fullName = `${sku} - ${formData.nom.trim()}`

      let imageUrls: string[] = []
      if (formData.photoOrder && formData.photoOrder.length > 0) {
        imageUrls = formData.photoOrder.map(item => item.url).filter(Boolean) as string[]
      } else {
        if (formData.existingPhotos.face) imageUrls.push(formData.existingPhotos.face)
        if (formData.existingPhotos.dos) imageUrls.push(formData.existingPhotos.dos)
        if (formData.existingPhotos.details) imageUrls.push(...formData.existingPhotos.details)
      }

      const photosReady = Boolean(formData.existingPhotos.face)
      const photosData: Record<string, any> = {}
      if (formData.existingPhotos.face) photosData.face = formData.existingPhotos.face
      if (formData.existingPhotos.dos) photosData.dos = formData.existingPhotos.dos
      if (formData.existingPhotos.details?.length) photosData.details = formData.existingPhotos.details

      const prixAchatNum = formData.prixAchat?.toString().trim() ? parseFloat(formData.prixAchat) : NaN

      const payload = {
        nom: fullName,
        description: formData.description || '',
        categorie: formData.categorie,
        prix: parseFloat(formData.prix),
        quantite: parseInt(formData.quantite) || 1,
        marque: formData.marque.trim(),
        taille: formData.taille.trim(),
        material: formData.material.trim() || null,
        color: formData.color.trim() || null,
        madeIn: formData.madeIn || null,
        modele: formData.modele?.trim() || null,
        motif: formData.motif?.trim() || null,
        sleeveLength: formData.sleeveLength?.trim() || null,
        collarType: formData.collarType?.trim() || null,
        garmentLength: formData.garmentLength?.trim() || null,
        closureType: formData.closureType?.trim() || null,
        shoeType: formData.shoeType?.trim() || null,
        sku,
        chineur: user.email,
        chineurUid: ACHETEUSE_CHINEUSE_DOC,
        categorieRapport,
        trigramme,
        photos: photosData,
        imageUrls,
        imageUrl: imageUrls[0] || '',
        ...(formData.videoUrl ? { videos: [formData.videoUrl] } : {}),
        ...(Number.isFinite(prixAchatNum) ? { prixAchat: prixAchatNum } : {}),
        photosReady,
        vendu: false,
        recu: false,
        createdAt: serverTimestamp(),
      }

      await setDoc(doc(db, 'produits', sku), payload)

      // Insère la pièce dans le cache blob `produits-all` (fire-and-forget)
      try {
        const token = await user.getIdToken()
        await fetch('/api/produits/patch-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ productId: sku }),
        })
      } catch { /* ignore */ }

      alert('✅ Produit ajouté avec succès !')
      await refreshSku()
    } catch (err: any) {
      console.error('💥 ERREUR:', err)
      alert('Erreur : FI')
    } finally {
      setLoading(false)
    }
  }

  const handleExcelImport = async (produits: ExcelImportData[]) => {
    if (!user) return
    try {
      let currentSkuNum = extractSkuNumFromSkuOrName(sku, trigramme) || 0
      let successCount = 0
      const createdSkus: string[] = []

      for (const produit of produits) {
        let rowSku = produit.sku
        if (!rowSku) {
          currentSkuNum++
          rowSku = `${trigramme}${currentSkuNum}`
        }
        const existingDoc = await getDoc(doc(db, 'produits', rowSku))
        if (existingDoc.exists()) { console.warn(`SKU "${rowSku}" existe déjà, ignoré`); continue }

        const payload = {
          nom: `${rowSku} - ${produit.nom}`,
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
          chineurUid: ACHETEUSE_CHINEUSE_DOC,
          categorieRapport,
          trigramme,
          imageUrls: [],
          vendu: false,
          recu: false,
          createdAt: serverTimestamp(),
        }
        await setDoc(doc(db, 'produits', rowSku), payload)
        createdSkus.push(rowSku)
        successCount++
      }

      if (createdSkus.length) {
        try {
          const token = await user.getIdToken()
          await fetch('/api/produits/patch-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ productIds: createdSkus }),
          })
        } catch { /* ignore */ }
      }

      alert(`✅ ${successCount} produit(s) importé(s) avec succès !`)
      await refreshSku()
    } catch (err: any) {
      console.error('Erreur import:', err)
      alert('❌ Erreur import : FI')
    }
  }

  // Aperçu import Vinted en attente de validation → remplace le formulaire.
  if (pendingPreview) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-4">
        <AchatPreviewSection
          initialItems={pendingPreview}
          targetChineuse={targetChineuse}
          categories={categories}
          onCancel={() => setPendingPreview(null)}
          onCreated={async () => { setPendingPreview(null); await refreshSku() }}
        />
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-4">
      <div className="mb-4">
        <p className="text-sm text-gray-500">Hello ACHETEUSE 👋</p>
        <h1 className="text-xl font-bold text-[#22209C]">AJOUTER UN PRODUIT</h1>
      </div>

      <ProductForm
        key={sku}
        mode="create"
        isAdmin={false}
        categories={categories}
        sku={sku}
        userName="ACHETEUSE"
        trigramme={trigramme}
        onSubmit={handleSubmit}
        onExcelImport={handleExcelImport}
        onVintedImport={() => setVintedModalOpen(true)}
        loading={loading}
        showExcelImport={true}
      />

      {vintedModalOpen && (
        <ImportMailModal
          onClose={() => setVintedModalOpen(false)}
          targetChineuse={targetChineuse}
          categories={categories}
          onItemsReady={(items) => { setVintedModalOpen(false); setPendingPreview(items) }}
        />
      )}
    </main>
  )
}
