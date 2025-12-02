// app/mes-produits/page.tsx
// =============================
// VERSION REFACTORISÉE AVEC PRODUCTFORM EN MODAL
// =============================

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
  getDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { MoreHorizontal, Trash2, ChevronDown, Sparkles, X } from 'lucide-react'
import { format } from 'date-fns'
import ProductForm, { ProductFormData, Cat } from '@/components/ProductForm'

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

type Produit = {
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
  ebayListingId?: string
  ebayOfferId?: string
  photos?: {
    face?: string
    faceOnModel?: string
    dos?: string
    details: string[]
  }
  imageUrl?: string
  imageUrls?: string[]
  photo?: string
  chineur?: string
  createdAt?: Timestamp
  catalogObjectId?: string
  variationId?: string
  itemId?: string
  statut?: 'retour' | 'supprime'
  dateRetour?: Timestamp | string
  photosReady?: boolean
}

export default function MesProduitsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  const [produits, setProduits] = useState<Produit[]>([])
  const [categories, setCategories] = useState<Cat[]>([])
  const [filtreCategorie, setFiltreCategorie] = useState<string>('')
  const [recherche, setRecherche] = useState<string>('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [menuOuvert, setMenuOuvert] = useState(false)

  // Modal édition
  const [editingProduct, setEditingProduct] = useState<Produit | null>(null)
  const [editingLoading, setEditingLoading] = useState(false)

  // Modal suppression
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null)
  const [justif, setJustif] = useState<'erreur' | 'produit_recupere' | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Génération IA
  const [generatingTryonId, setGeneratingTryonId] = useState<string | null>(null)

  // Chargement initial
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push('/login')
        return
      }
      setUser(u)

      const qy = query(collection(db, 'produits'), where('chineur', '==', u.email))
      const snap = await getDocs(qy)
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Produit[]

      const dataTries = data.sort((a, b) => {
        const da = a.createdAt instanceof Timestamp ? a.createdAt.toDate().getTime() : 0
        const dbt = b.createdAt instanceof Timestamp ? b.createdAt.toDate().getTime() : 0
        return dbt - da
      })
      setProduits(dataTries)

      const chineuseRef = doc(db, 'chineuse', u.uid)
      const chineuseSnap = await getDoc(chineuseRef)

      if (chineuseSnap.exists()) {
        const cd = chineuseSnap.data() as any
        const raw = cd['Catégorie'] ?? []

        const cats: Cat[] = Array.isArray(raw)
          ? raw
              .map((c: any) => {
                if (!c) return null
                if (typeof c === 'string') return { label: c }
                const label = (c.label ?? c.value ?? c.nom ?? '').toString().trim()
                if (!label) return null
                return {
                  label,
                  idsquare: c.idsquare ?? c.idSquare ?? c.squareId ?? c.id ?? undefined,
                }
              })
              .filter((c): c is Cat => !!c)
          : []

        setCategories(cats)
      } else {
        setCategories([])
      }
    })
    return () => unsubscribe()
  }, [router])

  // Filtres
  const produitsFiltres = useMemo(() => {
    const needle = recherche.trim().toLowerCase()
    return produits
      .filter((p) => p.statut !== 'supprime')
      .filter((p) => {
        const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
        if (filtreCategorie && cat !== filtreCategorie) return false
        if (!needle) return true
        const hay = [
          p.nom || '',
          p.description || '',
          p.marque || '',
          p.taille || '',
          cat || '',
          String(p.prix ?? ''),
          String(p.quantite ?? ''),
          String(p.sku ?? ''),
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(needle)
      })
  }, [produits, filtreCategorie, recherche])

  // Produits actifs = pas en retour ET quantité > 0
  const produitsActifs = useMemo(
    () => produitsFiltres.filter((p) => p.statut !== 'retour' && ((p.quantite ?? 1) > 0)),
    [produitsFiltres]
  )

  // Produits récupérés = statut retour
  const produitsRecuperes = useMemo(
    () => produitsFiltres.filter((p) => p.statut === 'retour'),
    [produitsFiltres]
  )

  // Helper pour obtenir toutes les images
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
    if (p.photo) return [p.photo]
    return []
  }

  // Générer photo portée
  const handleGenerateTryon = async (p: Produit) => {
    const faceUrl = p.photos?.face || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : p.imageUrl)
    
    if (!faceUrl) {
      alert('Pas de photo de face disponible')
      return
    }

    setGeneratingTryonId(p.id)

    try {
      const res = await fetch('/api/generate-tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: faceUrl,
          productName: p.nom
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erreur API')
      }

      const data = await res.json()

      if (data.success && data.onModelUrl) {
        const updatedPhotos = {
          ...(p.photos || { details: [] }),
          face: faceUrl,
          faceOnModel: data.onModelUrl
        }

        const newImageUrls = [
          faceUrl,
          data.onModelUrl,
          ...(p.photos?.dos ? [p.photos.dos] : []),
          ...(p.photos?.details || [])
        ]

        await updateDoc(doc(db, 'produits', p.id), {
          photos: updatedPhotos,
          imageUrls: newImageUrls,
          imageUrl: faceUrl,
          photosReady: true
        })

        setProduits((prev) => prev.map((prod) => 
          prod.id === p.id 
            ? { ...prod, photos: updatedPhotos, imageUrls: newImageUrls, photosReady: true }
            : prod
        ))

        setDirtyIds((prev) => new Set(prev).add(p.id))

        alert('✅ Photo portée générée avec succès !')
      } else {
        throw new Error(data.error || 'Erreur inconnue')
      }
    } catch (err: any) {
      console.error('❌ Erreur génération:', err)
      alert('❌ Erreur : ' + (err?.message || 'Impossible de générer la photo portée'))
    } finally {
      setGeneratingTryonId(null)
    }
  }

  // Sélection
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = (checked: boolean, list: Produit[]) => {
    setSelectedIds(checked ? new Set(list.map((p) => p.id)) : new Set())
  }

  // Mettre à jour en caisse
  const handleUpdateSquare = async () => {
    if (!user) return
    try {
      const normalize = (s: any) =>
        String(s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim()

      const chineuseRef = doc(db, 'chineuse', user.uid)
      const chineuseSnap = await getDoc(chineuseRef)
      const data = chineuseSnap.exists() ? chineuseSnap.data() : null

      const rawMap =
        (data as any)?.['Catégorie'] ??
        (data as any)?.['Catégories'] ??
        (data as any)?.['Categories'] ??
        (data as any)?.categories ??
        []

      const catRows: any[] = Array.isArray(rawMap) ? rawMap : []
      const labelToSquareId = (label: any): string | undefined => {
        const n = normalize(
          typeof label === 'object' ? (label?.label ?? label?.value) : label
        )
        const row = catRows.find((c) => normalize(c?.label ?? c?.value ?? c) === n)
        return (row?.idsquare || row?.idSquare || row?.squareId || row?.id) as string | undefined
      }

      const mappedChoices = catRows
        .filter((c) => c && (c.idsquare || c.idSquare || c.squareId || c.id))
        .map((c) => String(c.label ?? c.value ?? c))
        .filter(Boolean)

      const targets = (selectedIds.size > 0 ? selectedIds : dirtyIds)

      for (const produit of produitsActifs.filter((p) => targets.has(p.id))) {
        const rawLabel =
          typeof produit.categorie === 'object'
            ? (produit.categorie?.label ?? produit.categorie?.value)
            : produit.categorie

        let idsquare = labelToSquareId(rawLabel)

        if (!produit.catalogObjectId && !produit.variationId && !produit.itemId) {
          if (!idsquare) {
            const picked = prompt(
              `La catégorie "${rawLabel ?? '—'}" n'est pas mappée à Square pour « ${produit.nom} ».\n` +
              (mappedChoices.length
                ? `Choisis une catégorie parmi :\n${mappedChoices.join(' | ')}\n\nTape exactement le nom du menu.`
                : `Aucune catégorie Square mappée trouvée dans ta fiche. Ajoute "idsquare" sur tes catégories.`
              )
            )
            if (!picked) {
              alert(`Opération annulée pour « ${produit.nom} ».`)
              continue
            }
            const pickedId = labelToSquareId(picked)
            if (!pickedId) {
              alert(`Catégorie "${picked}" inconnue ou non mappée à Square.`)
              continue
            }
            await updateDoc(doc(db, 'produits', produit.id), { categorie: picked })
            setProduits((prev) => prev.map((p) => (p.id === produit.id ? { ...p, categorie: picked } : p)))
            idsquare = pickedId
          }

          if (!produit.nom || typeof produit.prix !== 'number' || Number.isNaN(produit.prix)) {
            alert(`Paramètres manquants pour « ${produit.nom || '(sans nom)'} » (prix requis).`)
            continue
          }

          const allImages = getAllImages(produit)

          const res = await fetch('/api/import-square-produits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nom: produit.nom,
              prix: produit.prix,
              description: produit.description,
              categorie: idsquare,
              marque: produit.marque,
              taille: produit.taille,
              chineurNom: user.uid,
              chineurEmail: user.email,
              stock: produit.quantite ?? 1,
              imageUrl: allImages[0],
              imageUrls: allImages,
              sku: produit.sku,
              productId: produit.id,
            }),
          })

          const text = await res.text()
          let resData: any = {}
          try { resData = JSON.parse(text) } catch {}
          if (!res.ok || !resData?.success) {
            alert(`Square: création échouée pour « ${produit.nom} »`)
            continue
          }

          const update: Record<string, any> = {}
          if (resData.catalogObjectId) update.catalogObjectId = resData.catalogObjectId
          if (resData.variationId) update.variationId = resData.variationId
          if (resData.itemId) update.itemId = resData.itemId
          if (Object.keys(update).length > 0) {
            await updateDoc(doc(db, 'produits', produit.id), update)
            setProduits((prev) => prev.map((p) => (p.id === produit.id ? { ...p, ...update } : p)))
          }
        } else {
          const allImages = getAllImages(produit)

          const res = await fetch('/api/update-square-produits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemId: produit.itemId,
              variationId: produit.variationId || produit.catalogObjectId,
              nom: produit.nom,
              description: produit.description,
              prix: produit.prix,
              sku: produit.sku,
              marque: produit.marque,
              taille: produit.taille,
              stock: produit.quantite ?? 1,
              categoryId: idsquare,
              imageUrls: allImages.length > 0 ? allImages : undefined,
            }),
          })

          const text = await res.text()
          let resData: any = {}
          try { resData = JSON.parse(text) } catch {}
          
          if (!res.ok || !resData?.success) {
            alert(`Square: mise à jour échouée pour « ${produit.nom} »\n${resData?.error || 'Erreur inconnue'}`)
            continue
          }
        }
      }

      alert('Caisse Square mise à jour ✅')
      setSelectedIds(new Set())
      setDirtyIds(new Set())
    } catch (error) {
      console.error(error)
      alert('Erreur réseau lors de la mise à jour Square')
    }
  }

  // Suppression
  const deleteEverywhere = async (id: string, reason: 'erreur' | 'produit_recupere' = 'erreur') => {
    if (!user) return
    const token = await user.getIdToken()
    const res = await fetch('/api/delete-produits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ productId: id, reason }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.error || 'Erreur API (suppression)')
    }
    setProduits((prev) => prev.filter((p) => p.id !== id))
    setSelectedIds((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
    setDirtyIds((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
  }

  const openDeleteSingle = (id: string) => {
    setConfirmIds([id])
    setJustif(null)
  }

  const openDeleteBulk = () => {
    if (selectedIds.size === 0) return
    setConfirmIds(Array.from(selectedIds))
    setJustif(null)
  }

  const confirmDelete = async () => {
    if (!user || !confirmIds || !justif) return
    setDeleting(true)
    try {
      for (const id of confirmIds) {
        await deleteEverywhere(id, justif)
      }
      setConfirmIds(null)
      setJustif(null)
      setMenuOuvert(false)
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Erreur réseau')
    } finally {
      setDeleting(false)
    }
  }

  // MAJ groupées
  const handleBatchUpdate = async (field: 'prix' | 'categorie' | 'quantite', value: any) => {
    if (selectedIds.size === 0) return

    for (const id of selectedIds) {
      await updateDoc(doc(db, 'produits', id), { [field]: value })
    }
    setProduits((prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, [field]: value } : p)))
    setMenuOuvert(false)

    setDirtyIds((prev) => {
      const n = new Set(prev)
      selectedIds.forEach((id) => n.add(id))
      return n
    })

    if (field === 'quantite' && Number(value) <= 0) {
      for (const id of Array.from(selectedIds)) {
        try {
          await deleteEverywhere(id, 'erreur')
        } catch (e) {
          console.warn('Suppression auto à 0 échouée pour', id, e)
        }
      }
    }
  }

  // =====================
  // ÉDITION VIA PRODUCTFORM
  // =====================
  const getInitialDataForEdit = (p: Produit) => ({
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

  const handleEditProduit = async (data: ProductFormData) => {
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
        description: data.description, 
        categorie: data.categorie,
        prix: parseFloat(data.prix), 
        quantite: parseInt(data.quantite),
        marque: data.marque?.trim(), 
        taille: data.taille?.trim(),
        material: data.material?.trim() || null, 
        color: data.color?.trim() || null,
        madeIn: data.madeIn || null, 
        photos, 
        imageUrls,
        imageUrl: imageUrls[0] || '', 
        photosReady: Boolean(photos.face),
      })

      // MAJ locale
      setProduits((prev) => prev.map((p) => 
        p.id === editingProduct.id 
          ? { 
              ...p, 
              nom: `${editingProduct.sku} - ${data.nom}`,
              description: data.description,
              categorie: data.categorie,
              prix: parseFloat(data.prix),
              quantite: parseInt(data.quantite),
              marque: data.marque?.trim(),
              taille: data.taille?.trim(),
              material: data.material?.trim() || undefined,
              color: data.color?.trim() || undefined,
              madeIn: data.madeIn || undefined,
              photos,
              imageUrls,
              imageUrl: imageUrls[0] || '',
              photosReady: Boolean(photos.face),
            } 
          : p
      ))

      setDirtyIds((prev) => new Set(prev).add(editingProduct.id))
      alert('Produit modifié !')
      setEditingProduct(null)
    } catch (error) { 
      alert('Erreur : ' + (error as any)?.message) 
    } finally { 
      setEditingLoading(false) 
    }
  }

  // Catégories pour le filtre (labels uniquement)
  const categoriesLabels = useMemo(() => categories.map(c => c.label), [categories])

  return (
    <>
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-center text-[#22209C] uppercase mb-6">
          MES PRODUITS CHEZ NOUVELLE RIVE
        </h1>

        {/* Filtres */}
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex-1 min-w-[200px]">
            <label className="font-medium block mb-1">Catégorie</label>
            <select
              value={filtreCategorie}
              onChange={(e) => setFiltreCategorie(e.target.value)}
              className="border px-2 py-2 rounded w-full"
            >
              <option value="">Toutes</option>
              {categoriesLabels.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[240px]">
            <label className="font-medium block mb-1">Rechercher</label>
            <input
              type="text"
              placeholder="nom, SKU, marque, taille…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="border px-2 py-2 rounded w-full"
            />
          </div>

          <button
            onClick={handleUpdateSquare}
            className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={selectedIds.size === 0 && dirtyIds.size === 0}
          >
            🔄 Mettre à jour en caisse
          </button>
        </div>

        {/* Menu actions groupées */}
        {selectedIds.size > 0 && (
          <div className="relative mb-3">
            <button
              onClick={() => setMenuOuvert(!menuOuvert)}
              className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-1"
            >
              Modifier ({selectedIds.size}) <ChevronDown size={16} />
            </button>
            {menuOuvert && (
              <div className="absolute mt-2 w-56 bg-white shadow-md rounded border z-10">
                <button
                  onClick={() => {
                    const prix = prompt('Nouveau prix ?')
                    if (prix !== null) handleBatchUpdate('prix', prix === '' ? '' : parseFloat(prix))
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Modifier le prix
                </button>
                <button
                  onClick={() => {
                    if (categoriesLabels.length === 0) {
                      alert("Aucune catégorie configurée.")
                      return
                    }
                    const cat = prompt('Catégorie :\n' + categoriesLabels.join(' | '))
                    if (!cat) return
                    if (!categoriesLabels.includes(cat)) {
                      alert('Catégorie invalide')
                      return
                    }
                    handleBatchUpdate('categorie', cat)
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Modifier la catégorie
                </button>
                <button
                  onClick={() => {
                    const qte = prompt('Nouvelle quantité ?')
                    if (qte !== null) handleBatchUpdate('quantite', qte === '' ? '' : parseInt(qte))
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Modifier la quantité
                </button>
                <button
                  onClick={openDeleteBulk}
                  className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sélection globale */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.size === produitsActifs.length && produitsActifs.length > 0}
              onChange={(e) => toggleAll(e.target.checked, produitsActifs)}
            />
            Tout sélectionner ({selectedIds.size}/{produitsActifs.length})
          </label>
        </div>

        {/* ===================== */}
        {/* LISTE PRODUITS ACTIFS */}
        {/* ===================== */}
        <div className="space-y-3">
          {produitsActifs.map((p) => {
            const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
            const allImages = getAllImages(p)
            const canGenerateTryon = canUseFashnAI(cat || '') && (p.photos?.face || allImages[0]) && !p.photos?.faceOnModel

            return (
              <div
                key={p.id}
                className="border rounded-lg p-3 shadow-sm bg-white flex gap-4 items-start"
              >
                {/* Checkbox */}
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelection(p.id)}
                  />
                </div>

                {/* Photos - max 3 */}
                <div className="flex-shrink-0">
                  <div className="flex gap-2 items-center flex-wrap">
                    {allImages.slice(0, 3).length > 0 ? (
                      allImages.slice(0, 3).map((url, idx) => (
                        <img 
                          key={idx} 
                          src={url} 
                          alt={`${p.nom} ${idx + 1}`} 
                          className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                          onClick={() => window.open(url, '_blank')}
                          title="Cliquer pour agrandir"
                        />
                      ))
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                        Pas de photo
                      </div>
                    )}
                    
                    {allImages.length > 3 && (
                      <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-600 text-sm">
                        +{allImages.length - 3}
                      </div>
                    )}
                  </div>
                </div>

                {/* Nom / Description / Date */}
                <div className="flex-1 min-w-[180px]">
                  <p className="font-semibold text-sm">{p.nom}</p>
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {p.createdAt instanceof Timestamp
                      ? format(p.createdAt.toDate(), 'dd/MM/yyyy')
                      : '—'}
                  </p>
                </div>

                {/* Catégorie / Marque / Taille */}
                <div className="w-32 text-xs space-y-1 hidden md:block">
                  <p><span className="text-gray-500">Cat:</span> {cat ?? '—'}</p>
                  <p><span className="text-gray-500">Marque:</span> {p.marque ?? '—'}</p>
                  <p><span className="text-gray-500">Taille:</span> {p.taille ?? '—'}</p>
                  {p.material && <p><span className="text-gray-500">Matière:</span> {p.material}</p>}
                  {p.color && <p><span className="text-gray-500">Couleur:</span> {p.color}</p>}
                </div>

                {/* SKU / Prix / Quantité */}
                <div className="w-28 text-xs space-y-1">
                  <p><span className="text-gray-500">SKU:</span> {p.sku ?? '—'}</p>
                  <p><span className="text-gray-500">Prix:</span> {typeof p.prix === 'number' ? `${p.prix} €` : '—'}</p>
                  <p><span className="text-gray-500">Qté:</span> {p.quantite ?? 1}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  {/* Bouton génération photo portée */}
                  {canGenerateTryon && (
                    <button
                      onClick={() => handleGenerateTryon(p)}
                      disabled={generatingTryonId === p.id}
                      className="p-1 text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50 transition"
                      title="Générer photo portée avec IA"
                    >
                      {generatingTryonId === p.id ? (
                        <span className="text-xs animate-pulse">⏳</span>
                      ) : (
                        <Sparkles size={18} />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => setEditingProduct(p)}
                    className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded"
                    title="Modifier"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  <button
                    onClick={() => openDeleteSingle(p.id)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {produitsActifs.length === 0 && (
          <p className="text-center text-gray-400 py-8">Aucun produit actif</p>
        )}

        {/* ======================== */}
        {/* PRODUITS RÉCUPÉRÉS */}
        {/* ======================== */}
        {produitsRecuperes.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold mb-4 text-gray-600">Produits récupérés</h2>
            <div className="space-y-3 opacity-70">
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
                    className="border rounded-lg p-3 shadow-sm bg-gray-50 flex gap-4 items-start"
                  >
                    <div className="w-5" />

                    {/* Photo */}
                    <div className="w-20 h-20 flex-shrink-0">
                      {allImages.length > 0 ? (
                        <img src={allImages[0]} alt={p.nom} className="w-20 h-20 object-cover rounded" />
                      ) : (
                        <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                          —
                        </div>
                      )}
                    </div>

                    {/* Nom / Description / Date retour */}
                    <div className="flex-1 min-w-[180px]">
                      <p className="font-semibold text-sm">{p.nom}</p>
                      {p.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                      )}
                      <p className="text-xs text-amber-600 mt-1">
                        Récupéré le {retourDate ? format(retourDate, 'dd/MM/yyyy') : '—'}
                      </p>
                    </div>

                    {/* Catégorie / Marque / Taille */}
                    <div className="w-32 text-xs space-y-1">
                      <p><span className="text-gray-500">Cat:</span> {cat ?? '—'}</p>
                      <p><span className="text-gray-500">Marque:</span> {p.marque ?? '—'}</p>
                      <p><span className="text-gray-500">Taille:</span> {p.taille ?? '—'}</p>
                    </div>

                    {/* SKU / Prix */}
                    <div className="w-28 text-xs space-y-1">
                      <p><span className="text-gray-500">SKU:</span> {p.sku ?? '—'}</p>
                      <p><span className="text-gray-500">Prix:</span> {typeof p.prix === 'number' ? `${p.prix} €` : '—'}</p>
                    </div>

                    <div className="w-12" />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modal Édition avec ProductForm */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Modifier : {editingProduct.sku}</h2>
              <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <ProductForm 
                mode="edit" 
                isAdmin={false} 
                categories={categories} 
                sku={editingProduct.sku || ''} 
                initialData={getInitialDataForEdit(editingProduct)} 
                onSubmit={handleEditProduit} 
                onCancel={() => setEditingProduct(null)} 
                loading={editingLoading}
                showExcelImport={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal justification suppression */}
      {confirmIds && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-3">Justification</h3>
            <p className="text-sm text-gray-600 mb-3">
              Pourquoi souhaitez-vous retirer {confirmIds.length > 1 ? 'ces articles' : 'cet article'} ?
            </p>

            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="justif"
                  checked={justif === 'erreur'}
                  onChange={() => setJustif('erreur')}
                />
                <span>Erreur (créé par erreur / information incorrecte)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="justif"
                  checked={justif === 'produit_recupere'}
                  onChange={() => setJustif('produit_recupere')}
                />
                <span>Produit récupéré par la chineuse</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setConfirmIds(null); setJustif(null) }}
                className="px-4 py-2 rounded border"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={!justif || deleting}
                className="px-4 py-2 rounded text-white bg-red-500 disabled:opacity-50"
              >
                {deleting ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}