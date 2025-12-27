    //src/components/ProductList.tsx
    'use client'

    import { useState, useMemo, useEffect } from 'react'
    import { db } from '@/lib/firebaseConfig'
    import { doc, updateDoc, onSnapshot, Timestamp, writeBatch, deleteField, collection } from 'firebase/firestore'
    import { processAndUploadProductPhoto, uploadMultiplePhotos } from '@/lib/imageProcessing'
    import { format } from 'date-fns'
    import { fr } from 'date-fns/locale'
    import { 
      MoreHorizontal, Trash2, ChevronUp, Sparkles, Clock,
      Search, X, FileSpreadsheet, Download, ChevronDown, RefreshCw, ImageIcon, Eye, EyeOff
    } from 'lucide-react'

    import * as XLSX from 'xlsx'
    import jsPDF from 'jspdf'
    import autoTable from 'jspdf-autotable'
    import ProductForm, { ProductFormData } from '@/components/ProductForm'
    import FilterBox from '@/components/FilterBox'

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
      recu?: boolean
      statutRecuperation?: 'aRecuperer' | 'vole' | null
      forceDisplay?: boolean
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

      // Chineuses depuis Firestore
      const [chineusesList, setChineusesList] = useState<{id: string, nom: string, authUid: string, email: string}[]>([])

      useEffect(() => {
        const unsub = onSnapshot(collection(db, 'chineuse'), (snap) => {
          const data = snap.docs.map(d => ({
            id: d.id,
            nom: d.data().nom || '',
            authUid: d.data().authUid || '',
            email: d.data().email || ''
          }))
          setChineusesList(data)
        })
        return () => unsub()
      }, [])

      // Filtres
      const [recherche, setRecherche] = useState('')
      const [filtreCategorie, setFiltreCategorie] = useState('')
      const [filtreDeposant, setFiltreDeposant] = useState('')
      const [filtreMois, setFiltreMois] = useState('')
      const [filtrePrix, setFiltrePrix] = useState('')
      const [tri, setTri] = useState<'date-desc' | 'date-asc' | 'alpha' | 'prix-asc' | 'prix-desc'>('date-desc')
      const [filtrePhotoManquante, setFiltrePhotoManquante] = useState(false)
      

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
      const [deleteReason, setDeleteReason] = useState<'erreur' | 'produit_recupere' | null>(null)
      const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([])
      const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number } | null>(null)

      // Actions
      const [updatingSquare, setUpdatingSquare] = useState(false)
      const [generatingTryonId, setGeneratingTryonId] = useState<string | null>(null)
      const [savingProduct, setSavingProduct] = useState(false)

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
        if ((p.quantite ?? 1) <= 0 || p.statut === 'retour') return false

        const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
        if (filtreCategorie && cat !== filtreCategorie) return false
        if (filtreDeposant && p.chineurUid !== filtreDeposant) return false

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

        // Prix exact
        if (filtrePrix) {
          const prixRecherche = parseFloat(filtrePrix.replace(',', '.'))
          if (!isNaN(prixRecherche)) {
            if (p.prix !== prixRecherche) return false
          }
        }

        // Photo manquante
        if (filtrePhotoManquante) {
          const hasPhoto = p.photos?.face || (p.imageUrls && p.imageUrls.length > 0) || p.imageUrl
          if (hasPhoto) return false
        }

          return true
        })
      }, [produits, recherche, filtreCategorie, filtreDeposant, filtreMois, filtrePrix, filtrePhotoManquante])

      const produitsTriés = useMemo(() => {
      return [...produitsFiltres].sort((a, b) => {
        if (tri === 'alpha') {
          return (a.nom || '').localeCompare(b.nom || '')
        }
        if (tri === 'prix-asc') {
          return (a.prix ?? 0) - (b.prix ?? 0)
        }
        if (tri === 'prix-desc') {
          return (b.prix ?? 0) - (a.prix ?? 0)
        }
        // Date (createdAt)
        const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toDate().getTime() : 0
        const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toDate().getTime() : 0
        return tri === 'date-asc' ? dateA - dateB : dateB - dateA
      })
    }, [produitsFiltres, tri])

      // Produits récupérés
      const produitsRecuperes = useMemo(() => {
      const needle = recherche.trim().toLowerCase()
      
      return produits
        .filter((p) => {
          if (p.statut !== 'retour') return false
          
          const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
          if (filtreCategorie && cat !== filtreCategorie) return false
          if (filtreDeposant && p.chineurUid !== filtreDeposant) return false
          
          if (filtreMois && p.dateRetour) {
            const dateRetour = p.dateRetour instanceof Timestamp 
              ? p.dateRetour.toDate() 
              : new Date(p.dateRetour as any)
            if (format(dateRetour, 'yyyy-MM') !== filtreMois) return false
          }
          
          if (needle) {
            const hay = [p.nom, p.sku, p.marque, p.taille, p.description, cat]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
            if (!hay.includes(needle)) return false
          }
          
          if (filtrePrix) {
            const prixRecherche = parseFloat(filtrePrix.replace(',', '.'))
            if (!isNaN(prixRecherche) && p.prix !== prixRecherche) return false
          }
          
          return true
        })
        // Tri par date de récupération (plus récent en premier)
        .sort((a, b) => {
          const dateA = a.dateRetour instanceof Timestamp 
            ? a.dateRetour.toDate().getTime() 
            : a.dateRetour ? new Date(a.dateRetour as any).getTime() : 0
          const dateB = b.dateRetour instanceof Timestamp 
            ? b.dateRetour.toDate().getTime() 
            : b.dateRetour ? new Date(b.dateRetour as any).getTime() : 0
          return dateB - dateA
        })
    }, [produits, recherche, filtreCategorie, filtreDeposant, filtreMois, filtrePrix])

      // Produits à récupérer
      const produitsARecuperer = useMemo(() => {
        return produits.filter((p) => p.statutRecuperation === 'aRecuperer' && p.statut !== 'supprime')
      }, [produits])

      // Options de filtres
      const chineursUniques = Array.from(
      new Set(produits.map((p) => p.chineurUid).filter(Boolean))
    ).sort((a, b) => (a || '').localeCompare(b || ''))
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
        setDeleteReason(null) 
        setShowDeleteModal(true)
      }

      const handleDeleteBulk = (ids: string[]) => {
        setBulkDeleteIds(ids)
        setDeleteTarget(null)
        setDeleteReason(null)
        setShowDeleteModal(true)
      }

      const confirmDelete = async () => {
      if (!deleteReason) {
        alert('Veuillez choisir une raison')
        return
      }

      const idsToDelete = bulkDeleteIds.length > 0 ? bulkDeleteIds : deleteTarget ? [deleteTarget] : []
      if (idsToDelete.length === 0) return

      try {
        const auth = (await import('firebase/auth')).getAuth()
        const token = await auth.currentUser?.getIdToken()
        
        if (!token) {
          alert('Vous devez être connecté')
          return
        }

        if (idsToDelete.length > 1) {
          setDeleteProgress({ current: 0, total: idsToDelete.length })
        }

        for (let i = 0; i < idsToDelete.length; i++) {
          const res = await fetch('/api/delete-produits', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              productId: idsToDelete[i],
              reason: deleteReason,
            }),
          })

          const data = await res.json()
          if (!data.success) {
            throw new Error(data.error || 'Erreur suppression')
          }

          if (idsToDelete.length > 1) {
            setDeleteProgress({ current: i + 1, total: idsToDelete.length })
          }
        }

        setDeleteProgress(null)
        setShowDeleteModal(false)
        setDeleteTarget(null)
        setBulkDeleteIds([])
        setDeleteReason(null)
        setSelectedIds(new Set())

        const actionLabel = deleteReason === 'produit_recupere' ? 'récupéré(s)' : 'supprimé(s)'
        alert(`${idsToDelete.length} produit(s) ${actionLabel}`)

      } catch (err: any) {
        console.error('Erreur suppression:', err)
        alert(err.message || 'Erreur lors de la suppression')
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
        const res = await fetch('/api/generate-tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: faceUrl, productName: p.nom }),
        })
        const data = await res.json()

        if (data.success && data.onModelUrl) {
          await updateDoc(doc(db, 'produits', p.id), {
            'photos.faceOnModel': data.onModelUrl,
          })
          alert('Photo portée générée !')
        } else {
          throw new Error(data.error || 'Erreur génération')
        }
      } catch (err: any) {
        console.error('Erreur génération photo portée:', err)
        alert(err.message || 'Erreur lors de la génération')
      } finally {
        setGeneratingTryonId(null)
      }
    }
      const handleToggleForceDisplay = async (p: Produit) => {
        try {
          await updateDoc(doc(db, 'produits', p.id), {
            forceDisplay: !p.forceDisplay
          })
        } catch (err) {
          console.error('Erreur toggle forceDisplay:', err)
        }
      }
    const handleUpdateSquare = async () => {
      const idsToSync = new Set([...selectedIds, ...dirtyIds])
      if (idsToSync.size === 0) {
        alert('Aucun produit à synchroniser')
        return
      }

      setDirtyIds(new Set())
      setSelectedIds(new Set())
      
      alert(`${idsToSync.size} produit(s) synchronisé(s)`)
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
        setSavingProduct(true)
        
        try {
          const productId = editingProduct.id
        
          // Préparer les URLs des photos
          let faceUrl: string | undefined = editingProduct.photos?.face
          let faceOriginalUrl: string | undefined = (editingProduct.photos as any)?.faceOriginal
          let dosUrl: string | undefined = editingProduct.photos?.dos
          let dosOriginalUrl: string | undefined = (editingProduct.photos as any)?.dosOriginal
          let faceOnModelUrl: string | undefined = editingProduct.photos?.faceOnModel
          
          // Gérer les photos détails existantes (filtrer les supprimées)
          let detailsUrls = [...(editingProduct.photos?.details || [])]
          if (data.deletedPhotos.detailsIndexes && data.deletedPhotos.detailsIndexes.length > 0) {
            detailsUrls = detailsUrls.filter((_, i) => !data.deletedPhotos.detailsIndexes?.includes(i))
          }
          
          // Upload nouvelle photo face (avec traitement complet)
          if (data.photoFace) {
            const result = await processAndUploadProductPhoto(data.photoFace)
            faceUrl = result.processed
            faceOriginalUrl = result.original
          }

          // Upload nouvelle photo dos (avec traitement complet)
          if (data.photoDos) {
            const result = await processAndUploadProductPhoto(data.photoDos)
            dosUrl = result.processed
            dosOriginalUrl = result.original
          }

          // Upload nouvelles photos détails (traitement léger)
          if (data.photosDetails.length > 0) {
            const newDetailsUrls = await uploadMultiplePhotos(data.photosDetails)
            detailsUrls.push(...newDetailsUrls)
          }
          
          // Gérer les suppressions de face/dos/faceOnModel
          if (data.deletedPhotos.face) {
            faceUrl = undefined
            faceOriginalUrl = undefined
          }
          if (data.deletedPhotos.dos) {
            dosUrl = undefined
            dosOriginalUrl = undefined
          }
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
          
          if (faceOriginalUrl) updateData['photos.faceOriginal'] = faceOriginalUrl
          else updateData['photos.faceOriginal'] = deleteField()
          
          if (dosUrl) updateData['photos.dos'] = dosUrl
          else updateData['photos.dos'] = deleteField()
          
          if (dosOriginalUrl) updateData['photos.dosOriginal'] = dosOriginalUrl
          else updateData['photos.dosOriginal'] = deleteField()
          
          if (faceOnModelUrl) updateData['photos.faceOnModel'] = faceOnModelUrl
          else updateData['photos.faceOnModel'] = deleteField()
          
          if (detailsUrls.length > 0) updateData['photos.details'] = detailsUrls
          else updateData['photos.details'] = deleteField()

          // Reconstruire imageUrls selon l'ordre défini par photoOrder
          if (data.photoOrder && data.photoOrder.length > 0) {
            const orderedUrls: string[] = []
            for (const item of data.photoOrder) {
              if (item.url) {
                // Pour les nouvelles photos, on doit utiliser les URLs uploadées
                if (item.id === 'new-face' && faceUrl) orderedUrls.push(faceUrl)
                else if (item.id === 'new-dos' && dosUrl) orderedUrls.push(dosUrl)
                else if (item.id.startsWith('new-detail-')) {
                  // L'index dans photosDetails
                  const idx = parseInt(item.id.replace('new-detail-', ''))
                  if (detailsUrls[idx]) orderedUrls.push(detailsUrls[idx])
                }
                // Pour les photos existantes
                else if (item.id === 'existing-face' && faceUrl) orderedUrls.push(faceUrl)
                else if (item.id === 'existing-faceOnModel' && faceOnModelUrl) orderedUrls.push(faceOnModelUrl)
                else if (item.id === 'existing-dos' && dosUrl) orderedUrls.push(dosUrl)
                else if (item.id.startsWith('existing-detail-')) {
                  const idx = parseInt(item.id.replace('existing-detail-', ''))
                  const originalDetails = editingProduct.photos?.details || []
                  if (originalDetails[idx] && !data.deletedPhotos.detailsIndexes?.includes(idx)) {
                    orderedUrls.push(originalDetails[idx])
                  }
                }
              }
            }
            if (orderedUrls.length > 0) {
              updateData.imageUrls = orderedUrls
              updateData.imageUrl = orderedUrls[0] // La première = image principale
            }
          } else {
            // Fallback : construire imageUrls dans l'ordre par défaut
            const defaultUrls: string[] = []
            if (faceUrl) defaultUrls.push(faceUrl)
            if (faceOnModelUrl) defaultUrls.push(faceOnModelUrl)
            if (dosUrl) defaultUrls.push(dosUrl)
            defaultUrls.push(...detailsUrls)
            if (defaultUrls.length > 0) {
              updateData.imageUrls = defaultUrls
              updateData.imageUrl = defaultUrls[0]
            }
          }
          
          await updateDoc(doc(db, 'produits', productId), updateData)
          
          setShowForm(false)
          setEditingProduct(null)
          alert('Produit mis à jour !')
            
      } catch (err: any) {
        console.error('Erreur sauvegarde:', err)
        alert('Erreur: ' + (err.message || 'Impossible de sauvegarder'))
      } finally {
        setSavingProduct(false)  // <-- ajoute cette ligne
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
      setFiltrePrix('')
      setTri('date-desc')
      setFiltrePhotoManquante(false)
    }

      const hasActiveFilters = !!(recherche || filtreCategorie || filtreDeposant || filtreMois || filtrePrix || filtrePhotoManquante)
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
            <h1 className="text-xl md:text-2xl font-bold text-[#22209C] text-center uppercase">{titre}</h1>
          </div>

          {/* Filtres - UTILISE FILTERBOX */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <FilterBox
              className="lg:col-span-2"
              hasActiveFilters={hasActiveFilters}
              onReset={resetFilters}
              filters={{
                recherche: {
                  value: recherche,
                  onChange: setRecherche,
                  placeholder: 'nom, SKU, marque...'
                },
                mois: {
                  value: filtreMois,
                  onChange: setFiltreMois,
                  options: moisUniques.map(m => ({
                    value: m,
                    label: format(new Date(m + '-01'), 'MMM yyyy', { locale: fr })
                  }))
                },
                chineuse: {
                  value: filtreDeposant,
                  onChange: setFiltreDeposant,
                  options: chineusesList
                    .filter(c => c.nom)
                    .map(c => ({
                      value: c.authUid,
                      label: c.nom.toUpperCase()
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label))
                },
                categorie: {
                  value: filtreCategorie,
                  onChange: setFiltreCategorie,
                  options: (filtreDeposant 
                    ? Array.from(new Set(
                        produits
                          .filter(p => p.chineurUid === filtreDeposant)
                          .map(p => typeof p.categorie === 'object' ? p.categorie?.label : p.categorie)
                          .filter(Boolean)
                      ))
                    : categoriesUniques
                  ).map(c => ({
                    value: c as string,
                    label: c as string
                  }))
                },
                prix: {
                  value: filtrePrix,
                  onChange: setFiltrePrix,
                  placeholder: 'Ex: 95'
                },
                tri: {
                  value: tri,
                  onChange: (v) => setTri(v as 'date-desc' | 'date-asc' | 'alpha' | 'prix-asc' | 'prix-desc'),
                },
                photoManquante: {
                  value: filtrePhotoManquante,
                  onChange: setFiltrePhotoManquante,
                },
              }}
            />

            {/* Exporter - hidden on mobile */}
            <div className="hidden lg:block bg-white border rounded-xl p-4 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Exporter</h2>
              <div className="flex flex-col gap-3">
                <button onClick={exportToExcel} className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
                  <FileSpreadsheet size={14} /> Excel
                </button>
                <button onClick={exportToPDF} className="flex items-center justify-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors">
                  <Download size={14} /> PDF
                </button>
              </div>
            </div>
          </div>

          {/* Compteur */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-500">
              {produitsTriés.length} produit(s)
            </span>
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
                checked={selectedIds.size === produitsTriés.length && produitsTriés.length > 0}
                onChange={(e) => toggleAll(e.target.checked, produitsTriés)}
                className="rounded border-gray-300 text-[#22209C] focus:ring-[#22209C]"
              />
              Tout sélectionner ({selectedIds.size}/{produitsTriés.length})
            </label>
          </div>

          {/* Liste produits - Nouveau Design */}
          <div className="space-y-3">
            {produitsTriés.map((p) => {
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
                  className={`bg-white rounded-xl border ${isSelected ? 'border-[#22209C] ring-2 ring-[#22209C]/20' : 'border-gray-200'} ${isDirty ? 'border-l-4 border-l-amber-400' : ''} ${p.recu === false ? 'opacity-50 bg-gray-50' : ''} p-4 shadow-sm hover:shadow-md transition-all`}
                >
                  {/* MOBILE */}
                  <div className="sm:hidden flex gap-3">
                    <div className="flex-shrink-0 flex flex-col gap-1">
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(p.id)} className="w-4 h-4 mt-1 rounded border-gray-300 text-[#22209C] focus:ring-[#22209C]" />
                        {allImages.length > 0 ? (
                          <img src={allImages[0]} alt={p.nom} className="w-16 h-16 object-cover rounded-lg cursor-pointer" onClick={() => window.open(allImages[0], '_blank')} />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center"><ImageIcon size={20} className="text-gray-400" /></div>
                        )}
                      </div>
                      {allImages.length > 1 && (
                        <div className="flex gap-1 ml-6">
                          <img src={allImages[1]} alt={`${p.nom} 2`} className="w-8 h-8 object-cover rounded cursor-pointer" onClick={() => window.open(allImages[1], '_blank')} />
                          {allImages.length > 2 && <button onClick={() => toggleExpanded(p.id)} className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-500 text-xs font-medium">+{allImages.length - 2}</button>}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">{p.sku && <span className="text-[#22209C]">{p.sku}</span>}{p.sku && <span className="text-gray-400"> - </span>}{(p.nom || '').replace(new RegExp(`^${p.sku}\\s*-\\s*`, 'i'), '')}</h3>
                      <p className="text-xs text-gray-400 mt-1">{p.createdAt instanceof Timestamp ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : '—'}</p>
                      {p.recu === false && <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-1"><Clock size={12} /> En attente</span>}
                    </div>
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      {canGenerateTryon && <button onClick={() => handleGenerateTryon(p)} disabled={generatingTryonId === p.id} className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg disabled:opacity-50">{generatingTryonId === p.id ? <span className="text-xs">⏳</span> : <Sparkles size={16} />}</button>}
                      <button onClick={() => handleEdit(p)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><MoreHorizontal size={16} /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      <button onClick={() => handleToggleForceDisplay(p)} className={`p-1.5 rounded-lg ${p.forceDisplay ? 'text-green-500' : 'text-gray-300'}`}>{p.forceDisplay ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                    </div>
                  </div>
                  <div className="sm:hidden flex gap-4 mt-3 pt-3 border-t border-gray-100 text-sm">
                    <span><span className="text-gray-400">SKU:</span> <span className="font-medium">{p.sku || '—'}</span></span>
                    <span><span className="text-gray-400">Prix:</span> <span className="font-medium">{typeof p.prix === 'number' ? `${p.prix} €` : '—'}</span></span>
                    <span><span className="text-gray-400">Qté:</span> <span className="font-medium">{p.quantite ?? 1}</span></span>
                  </div>
                  {isExpanded && allImages.length > 2 && (
                    <div className="sm:hidden mt-3 pt-3 border-t border-gray-100">
                      <div className="flex gap-2 flex-wrap">
                        {allImages.slice(2).map((url, idx) => <img key={idx} src={url} alt={`${p.nom} ${idx + 3}`} className="w-12 h-12 object-cover rounded-lg cursor-pointer" onClick={() => window.open(url, '_blank')} />)}
                        <button onClick={() => toggleExpanded(p.id)} className="text-xs text-[#22209C] hover:underline flex items-center gap-1"><ChevronUp size={14} /> Réduire</button>
                      </div>
                    </div>
                  )}

                  {/* DESKTOP */}
                  <div className="hidden sm:flex items-start gap-4">
                    <div className="flex-shrink-0 pt-1"><input type="checkbox" checked={isSelected} onChange={() => toggleSelection(p.id)} className="w-4 h-4 rounded border-gray-300 text-[#22209C] focus:ring-[#22209C]" /></div>
                    <div className="flex-shrink-0">
                      {allImages.length > 0 ? <img src={allImages[0]} alt={p.nom} className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-90" onClick={() => window.open(allImages[0], '_blank')} /> : <div className="w-20 h-20 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 gap-1"><ImageIcon size={24} className="text-green-400" /><span className="text-[10px]">{p.sku || p.nom?.substring(0, 10)}</span></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base">{p.sku && <span className="text-[#22209C]">{p.sku}</span>}{p.sku && <span className="text-gray-400"> - </span>}{(p.nom || '').replace(new RegExp(`^${p.sku}\\s*-\\s*`, 'i'), '')}</h3>
                      {p.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">{p.createdAt instanceof Timestamp ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : '—'}</p>
                      {isAdmin && <p className="text-xs text-gray-400 mt-0.5">{getChineurName(p.chineur)}</p>}
                      {p.recu === false && <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-1"><Clock size={12} /> En attente de réception</span>}
                    </div>
                    <div className="hidden md:flex flex-col text-sm text-gray-600 space-y-1 min-w-[140px]">
                      <p><span className="text-gray-400">Taille:</span> <span className="font-medium text-gray-700">{p.taille || '—'}</span></p>
                      <p><span className="text-gray-400">Marque:</span> <span className="font-medium text-gray-700">{p.marque || '—'}</span></p>
                      <p><span className="text-gray-400">Matière:</span> <span className="font-medium text-gray-700">{p.material || '—'}</span></p>
                      <p><span className="text-gray-400">Couleur:</span> <span className="font-medium text-gray-700">{p.color || '—'}</span></p>
                    </div>
                    <div className="flex flex-col items-end text-sm text-gray-600 space-y-1 min-w-[120px]">
                      <p><span className="text-gray-400">SKU:</span> <span className="font-medium text-gray-700">{p.sku || '—'}</span></p>
                      <p><span className="text-gray-400">Prix:</span> <span className="font-medium text-gray-700">{typeof p.prix === 'number' ? `${p.prix} €` : '—'}</span></p>
                      <p><span className="text-gray-400">Qté:</span> <span className="font-medium text-gray-700">{p.quantite ?? 1}</span></p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canGenerateTryon && <button onClick={() => handleGenerateTryon(p)} disabled={generatingTryonId === p.id} className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg disabled:opacity-50">{generatingTryonId === p.id ? <span className="text-xs animate-pulse">⏳</span> : <Sparkles size={20} />}</button>}
                      <button onClick={() => handleEdit(p)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><MoreHorizontal size={20} /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={20} /></button>
                      <button onClick={() => handleToggleForceDisplay(p)} className={`p-2 rounded-lg ${p.forceDisplay ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}>{p.forceDisplay ? <Eye size={18} /> : <EyeOff size={18} />}</button>
                    </div>
                  </div>
                  {allImages.length > 1 && (
                    <div className="hidden sm:block mt-3 pt-3 border-t border-gray-100">
                      <div className="flex gap-2 items-center flex-wrap">
                        {displayImages.slice(1).map((url, idx) => <img key={idx} src={url} alt={`${p.nom} ${idx + 2}`} className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80" onClick={() => window.open(url, '_blank')} />)}
                        {hasMoreImages && !isExpanded && <button onClick={() => toggleExpanded(p.id)} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-xs font-medium hover:bg-gray-200">+{allImages.length - 2}</button>}
                        {isExpanded && allImages.length > 2 && <button onClick={() => toggleExpanded(p.id)} className="text-xs text-[#22209C] hover:underline flex items-center gap-1"><ChevronUp size={14} /> Réduire</button>}
                      </div>
                    </div>
                  )}
                  
              
                </div>
              )
            })}
          </div>

          {produitsTriés.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400">Aucun produit</p>
            </div>
          )}

        {/* Produits à récupérer */}
              {produitsARecuperer.length > 0 && (
                <div className="mt-8 bg-amber-50 rounded-xl border border-amber-200 p-4">
                  <h3 className="text-lg font-semibold mb-4 text-amber-700">
                    ⚠️ À récupérer ({produitsARecuperer.length})
                  </h3>
                  <div className="space-y-3">
                    {produitsARecuperer.map((p) => {
                      const allImages = getAllImages(p)
                      return (
                        <div key={p.id} className="bg-white rounded-lg border border-amber-200 p-3 flex items-center gap-3">
                          {allImages.length > 0 ? (
                            <img src={allImages[0]} alt={p.nom} className="w-16 h-16 object-cover rounded-lg" />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                              <ImageIcon size={20} className="text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              {p.sku && <span className="text-amber-600">{p.sku}</span>}
                              {p.sku && ' - '}
                              {(p.nom || '').replace(new RegExp(`^${p.sku}\\s*-\\s*`, 'i'), '')}
                            </h4>
                            <p className="text-sm text-gray-500">{typeof p.prix === 'number' ? `${p.prix} €` : '—'}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
                      <div className="flex-1 min-w-0 order-last sm:order-none w-full sm:w-auto mt-2 sm:mt-0">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                          {p.sku && <span className="text-[#22209C]">{p.sku}</span>}
                          {p.sku && <span className="text-gray-400"> - </span>}
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
                      productId={editingProduct?.id}
                      categories={categories.length > 0 ? categories : categoriesUniques.map(c => ({ label: c as string }))}
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
                    loading={savingProduct}
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
            {bulkDeleteIds.length > 0 ? `${bulkDeleteIds.length} produit(s)` : 'Ce produit'}
          </h3>
          <p className="text-sm text-gray-500 mb-6">Quelle est la raison ?</p>

          {!deleteProgress ? (
            <div className="space-y-3">
              {/* Bouton Erreur */}
              <button
                onClick={() => setDeleteReason('erreur')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  deleteReason === 'erreur'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">❌ Erreur de saisie</div>
                <div className="text-sm text-gray-500 mt-1">
                  Le produit sera supprimé définitivement (Firestore + Square)
                </div>
              </button>

              {/* Bouton Récupéré */}
              <button
                onClick={() => setDeleteReason('produit_recupere')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  deleteReason === 'produit_recupere'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">📦 Produit récupéré</div>
                <div className="text-sm text-gray-500 mt-1">
                  Le produit sera archivé et visible dans "Produits récupérés"
                </div>
              </button>
            </div>
          ) : (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Suppression en cours...</span>
                <span>{deleteProgress.current}/{deleteProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-red-600 h-2 rounded-full transition-all" 
                  style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }} 
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={() => {
                setShowDeleteModal(false)
                setDeleteTarget(null)
                setBulkDeleteIds([])
                setDeleteReason(null)
              }}
              disabled={!!deleteProgress}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={confirmDelete}
              disabled={!deleteReason || !!deleteProgress}
              className={`px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50 transition-colors ${
                deleteReason === 'erreur' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {deleteReason === 'produit_recupere' ? 'Archiver' : 'Supprimer'}
            </button>
          </div>
        </div>
      </div>
    )}
        </div>
      )
    }