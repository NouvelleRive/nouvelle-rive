  // components/InventaireList.tsx
  'use client'

  import { useState, useMemo, useRef, useEffect } from 'react'
  import { useRouter } from 'next/navigation'
  import { db, auth } from '@/lib/firebaseConfig'
  import { doc, updateDoc, deleteDoc, Timestamp, increment } from 'firebase/firestore'
  import {
    Search, X, Check, AlertTriangle, Package, PackageCheck,
    ImageIcon, Edit3, Filter, Camera, Upload
  } from 'lucide-react'

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
    statut?: 'retour' | 'supprime' | 'vendu'
    recu?: boolean
    dateReception?: Timestamp
    recuPar?: string
    enBoutique?: boolean
    dateInventaire?: Timestamp
    inventairePar?: string
    inventaireId?: string
    statutRecuperation?: 'aRecuperer' | 'vole' | null
    dateSignalement?: Timestamp
    signalePar?: string
    source?: 'chineuse' | 'deposante' | 'achat-vinted' | 'achat-vestiaire' | 'achat-drouot'
    trigramme?: string
    photosDefautsReception?: string[]
    noteReception?: string
    bonDepotEnvoyeAt?: Timestamp
  }

  export type Deposant = {
    id: string
    email: string
    nom?: string
    trigramme?: string
  }

  type Mode = 'inventaire' | 'reception' | 'destock'

  interface InventaireListProps {
    mode: Mode
    produits: Produit[]
    deposants?: Deposant[]
    inventaireId?: string
    inventaireNom?: string
    vendeusePrenom: string
    onProductUpdate?: () => void
    loading?: boolean
  }

  // =====================
  // HELPERS
  // =====================
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

  // Extraire le numéro du SKU pour tri (MIS1 → 1, CAM47 → 47)
  const extractSkuNumber = (sku: string | undefined): number => {
    if (!sku) return 999999
    const match = sku.match(/(\d+)$/)
    return match ? parseInt(match[1], 10) : 999999
  }

  // Upload Bunny
  async function uploadToBunny(file: File): Promise<string> {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const filename = `inventaire_${timestamp}_${random}.png`
    const path = `produits/${filename}`

    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8Array.slice(i, i + chunkSize))
    }
    const base64 = btoa(binary)

    const response = await fetch('/api/upload-bunny', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, path, contentType: file.type || 'image/png' })
    })

    if (!response.ok) throw new Error('Erreur upload')
    const data = await response.json()
    return data.url
  }

  // =====================
  // COMPONENT
  // =====================
  export default function InventaireList({
    mode,
    produits,
    deposants = [],
    inventaireId,
    inventaireNom,
    vendeusePrenom,
    onProductUpdate,
    loading = false,
  }: InventaireListProps) {
    const [recherche, setRecherche] = useState('')
    const [filtreCategorie, setFiltreCategorie] = useState('')
    const [filtreDeposant, setFiltreDeposant] = useState('')
    const [filtrePrix, setFiltrePrix] = useState<string>('')
    const [filtreStatut, setFiltreStatut] = useState<'tous' | 'trouves' | 'nonTrouves'>('tous')
    const [showFilters, setShowFilters] = useState(false)
    const [showSignalModal, setShowSignalModal] = useState(false)
    const [signalTarget, setSignalTarget] = useState<Produit | null>(null)
    const [signalType, setSignalType] = useState<'aRecuperer' | 'vole'>('aRecuperer')
    const [showEditModal, setShowEditModal] = useState(false)
    const [editTarget, setEditTarget] = useState<Produit | null>(null)
    const [editValues, setEditValues] = useState<{ prix?: string; taille?: string; marque?: string }>({})
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
    const [newPhotos, setNewPhotos] = useState<File[]>([])
    const [uploadingPhotos, setUploadingPhotos] = useState(false)
    // Réception DEP (déposante) : modale de confirmation avec note + photos défauts
    const [receptionTarget, setReceptionTarget] = useState<Produit | null>(null)
    const [receptionNote, setReceptionNote] = useState('')
    const [receptionDefautUrls, setReceptionDefautUrls] = useState<string[]>([])
    const [receptionUploading, setReceptionUploading] = useState(false)
    const [receptionSaving, setReceptionSaving] = useState(false)
    // Popup "Générer bon de dépôt" quand toutes les pièces DEP du trigramme sont reçues
    const [bonDepotTrigramme, setBonDepotTrigramme] = useState<string | null>(null)
    const [bonDepotGenerating, setBonDepotGenerating] = useState(false)
    // Popup "pièces à rendre ou prix à baisser ?" + "photos correctes ?" quand toutes les pièces chineuse en réception sont acceptées
    const [restockFiniChineuse, setRestockFiniChineuse] = useState<{ trigramme: string; nom: string } | null>(null)
    const [restockPhotoIndex, setRestockPhotoIndex] = useState(0)
    const [restockShowGrid, setRestockShowGrid] = useState(false)
    const [favTogglingId, setFavTogglingId] = useState<string | null>(null)
    const [generatingPorteId, setGeneratingPorteId] = useState<string | null>(null)
    const [igPublishingId, setIgPublishingId] = useState<string | null>(null)
    const router = useRouter()
    // Infinite scroll
    const [visibleCount, setVisibleCount] = useState(20)
    const loaderRef = useRef<HTMLDivElement>(null)
    const cameraRef = useRef<HTMLInputElement>(null)

    const getChineurName = (email: string | undefined) => {
      if (!email) return '—'
      const dep = deposants.find((d) => d.email === email)
      return dep?.nom || email.split('@')[0]
    }

    // Trigramme canonique d'un produit (depuis p.trigramme, fallback préfixe SKU)
    const getTri = (p: Produit): string => {
      if (p.trigramme) return p.trigramme.toUpperCase()
      const m = p.sku?.match(/^[A-Za-z]+/)
      return (m?.[0] || '').toUpperCase()
    }

    // Nom lisible d'une chineuse à partir de son trigramme
    const getNomFromTri = (tri: string | undefined) => {
      if (!tri) return '—'
      const up = tri.toUpperCase()
      const dep = deposants.find((d) => (d.trigramme || '').toUpperCase() === up)
      if (dep?.nom) return dep.nom
      // Fallback : un produit portant ce trigramme
      const p = produits.find((pp) => getTri(pp) === up && pp.chineur)
      if (p?.chineur) return getChineurName(p.chineur)
      return up
    }

    // Filtre par chineuse = par trigramme (une chineuse peut avoir plusieurs emails)
    const deposantsUniques = Array.from(new Set(produits.map(getTri).filter(Boolean)))
      .sort((a, b) => getNomFromTri(a).localeCompare(getNomFromTri(b), 'fr'))
      const categoriesUniques = Array.from(
        new Set(
          produits
            .map((p) => (typeof p.categorie === 'object' ? p.categorie?.label : p.categorie))
            .filter(Boolean)
        )
      ).sort((a, b) => (a as string).localeCompare(b as string, 'fr'))

    // Helper pour savoir si un produit est trouvé dans cet inventaire
    const isProductFound = (p: Produit) => p.enBoutique && p.inventaireId === inventaireId

    const produitsFiltres = useMemo(() => {
      const needle = recherche.trim().toLowerCase()
      
      let filtered = produits.filter((p) => {
        if (p.statut === 'supprime') return false
        
        if (mode === 'inventaire') {
          if (p.vendu || (p.quantite ?? 1) <= 0 || p.statut === 'retour') return false
        } else if (mode === 'reception') {
          const isRestock = (p as any).statutRestock === 'enAttente'
          if (!isRestock && p.recu !== false) return false
        } else if (mode === 'destock') {
          if (p.statutRecuperation !== 'aRecuperer' && (p as any).statutDestock !== 'enAttente') return false
        }

        const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
        if (filtreCategorie && cat !== filtreCategorie) return false
        if (filtreDeposant && getTri(p) !== filtreDeposant) return false

        // Filtre par statut trouvé/non trouvé
        if (mode === 'inventaire' && filtreStatut !== 'tous') {
          const found = isProductFound(p)
          if (filtreStatut === 'trouves' && !found) return false
          if (filtreStatut === 'nonTrouves' && found) return false
        }

        // Filtre par prix exact
        if (filtrePrix !== '') {
          const prixRecherche = parseFloat(filtrePrix)
          if (!isNaN(prixRecherche) && p.prix !== prixRecherche) return false
        }

        if (needle) {
          const hay = [p.nom, p.sku, p.marque, p.taille, p.description, cat, p.chineur, getChineurName(p.chineur)]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (!hay.includes(needle)) return false
        }

        return true
      })

      // Tri : non trouvés en premier, puis par SKU croissant
      if (mode === 'inventaire') {
        filtered.sort((a, b) => {
          const aFound = isProductFound(a)
          const bFound = isProductFound(b)
          
          // Non trouvés en premier
          if (aFound !== bFound) {
            return aFound ? 1 : -1
          }
          
          // Puis tri par SKU croissant
          return extractSkuNumber(a.sku) - extractSkuNumber(b.sku)
        })
      }

      return filtered
    }, [produits, recherche, filtreCategorie, filtreDeposant, filtreStatut, filtrePrix, mode, inventaireId])

    const produitsParChineuse = useMemo(() => {
      const grouped: Record<string, Produit[]> = {}
      for (const p of produitsFiltres) {
        // Regroupement par trigramme (canonique) : une chineuse = une clé,
        // même si elle utilise plusieurs emails.
        const key = getTri(p) || 'SANS-TRI'
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(p)
      }

      for (const key in grouped) {
        grouped[key].sort((a, b) => {
          if (mode === 'inventaire') {
            const aFound = isProductFound(a)
            const bFound = isProductFound(b)
            if (aFound !== bFound) return aFound ? 1 : -1
          }
          return extractSkuNumber(a.sku) - extractSkuNumber(b.sku)
        })
      }

      return grouped
    }, [produitsFiltres, mode, inventaireId])

    // Infinite scroll observer
    useEffect(() => {
      const loader = loaderRef.current
      if (!loader) return
      
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && visibleCount < produitsFiltres.length) {
            setVisibleCount(prev => Math.min(prev + 20, produitsFiltres.length))
          }
        },
        { threshold: 0.1, rootMargin: '100px' }
      )
      
      observer.observe(loader)
      return () => observer.disconnect()
    }, [visibleCount, produitsFiltres.length])

    // Reset quand les filtres changent
    useEffect(() => {
      setVisibleCount(20)
    }, [recherche, filtreCategorie, filtreDeposant, filtrePrix, filtreStatut, mode])

    const stats = useMemo(() => {
      if (mode === 'inventaire') {
        const total = produitsFiltres.length
        const trouves = produitsFiltres.filter((p) => isProductFound(p)).length
        const restants = total - trouves
        
        // Calculer la somme des restants
        const sommeRestants = produitsFiltres
          .filter((p) => !isProductFound(p))
          .reduce((sum, p) => sum + (p.prix || 0), 0)
        
        // Calculer la somme des trouvés
        const sommeTrouves = produitsFiltres
          .filter((p) => isProductFound(p))
          .reduce((sum, p) => sum + (p.prix || 0), 0)
        
        return { total, trouves, restants, sommeRestants, sommeTrouves }
      }
      return { total: produitsFiltres.length, trouves: 0, restants: 0, sommeRestants: 0, sommeTrouves: 0 }
    }, [produitsFiltres, mode, inventaireId])

    const handleMarkFound = async (p: Produit) => {
      if (processingIds.has(p.id)) return
      setProcessingIds((prev) => new Set(prev).add(p.id))

      try {
        await updateDoc(doc(db, 'produits', p.id), {
          enBoutique: true,
          dateInventaire: Timestamp.now(),
          inventairePar: vendeusePrenom,
          inventaireId: inventaireId,
        })
        onProductUpdate?.()
      } catch (err) {
        console.error('Erreur marquage:', err)
        alert('Erreur : FI')
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev)
          next.delete(p.id)
          return next
        })
      }
    }

    const handleUnmarkFound = async (p: Produit) => {
      if (processingIds.has(p.id)) return
      setProcessingIds((prev) => new Set(prev).add(p.id))

      try {
        await updateDoc(doc(db, 'produits', p.id), {
          enBoutique: false,
          dateInventaire: null,
          inventairePar: null,
          inventaireId: null,
        })
        onProductUpdate?.()
      } catch (err) {
        console.error('Erreur annulation:', err)
        alert('Erreur : FI')
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev)
          next.delete(p.id)
          return next
        })
      }
    }

    const handleSignal = async () => {
      if (!signalTarget) return
      setProcessingIds((prev) => new Set(prev).add(signalTarget.id))

      try {
        await updateDoc(doc(db, 'produits', signalTarget.id), {
          statutRecuperation: signalType,
          dateSignalement: Timestamp.now(),
          signalePar: vendeusePrenom,
        })
        setShowSignalModal(false)
        setSignalTarget(null)
        onProductUpdate?.()
      } catch (err) {
        console.error('Erreur signalement:', err)
        alert('Erreur : FI')
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev)
          next.delete(signalTarget?.id || '')
          return next
        })
      }
    }

    const handleMarkReceived = async (p: Produit) => {
      if (processingIds.has(p.id)) return
      // Pour une pièce déposante : ouvrir la modale de confirmation (note + photos défauts)
      if (p.source === 'deposante') {
        setReceptionTarget(p)
        setReceptionNote('')
        setReceptionDefautUrls([])
        return
      }
      // Sinon, réception directe (chineuses)
      setProcessingIds((prev) => new Set(prev).add(p.id))
      try {
        const update: Record<string, unknown> = {
          recu: true,
          dateReception: Timestamp.now(),
          recuPar: vendeusePrenom,
        }
        // Brouillon achat (Vinted/Whatnot/Fleek/…) : passer aussi achatStatut
        // à 'recu-boutique' pour retirer le grisé + le badge livraison et
        // remettre le produit dans le flux vendeuse classique.
        if (typeof p.source === 'string' && p.source.startsWith('achat-')) {
          update.achatStatut = 'recu-boutique'
        }
        await updateDoc(doc(db, 'produits', p.id), update)
        fetch('/api/ebay/publish-if-luxe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: p.id }),
        }).catch(() => {})
        onProductUpdate?.()

        // Si c'était la dernière pièce de cette chineuse (trigramme) à recevoir
        // en mode réception : proposer de vérifier pièces à rendre / prix à baisser
        // NB : une chineuse peut avoir plusieurs emails → on regroupe par trigramme.
        const tri = getTri(p)
        if (mode === 'reception' && tri) {
          const remaining = produits.filter(o =>
            o.id !== p.id &&
            getTri(o) === tri &&
            o.statut !== 'supprime' &&
            (((o as any).statutRestock === 'enAttente') || o.recu === false)
          )
          if (remaining.length === 0) {
            setRestockPhotoIndex(0)
            setRestockFiniChineuse({ trigramme: tri, nom: getNomFromTri(tri) })
          }
        }
      } catch (err) {
        console.error('Erreur réception:', err)
        alert('Erreur : FI')
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev)
          next.delete(p.id)
          return next
        })
      }
    }

    // Confirmation depuis la modale réception DEP : update + check fin de session
    const confirmReceptionDep = async () => {
      if (!receptionTarget) return
      setReceptionSaving(true)
      try {
        const update: any = {
          recu: true,
          dateReception: Timestamp.now(),
          recuPar: vendeusePrenom,
        }
        if (receptionNote.trim()) update.noteReception = receptionNote.trim()
        if (receptionDefautUrls.length > 0) update.photosDefautsReception = receptionDefautUrls
        await updateDoc(doc(db, 'produits', receptionTarget.id), update)

        fetch('/api/ebay/publish-if-luxe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: receptionTarget.id }),
        }).catch(() => {})

        const target = receptionTarget
        setReceptionTarget(null)
        setReceptionNote('')
        setReceptionDefautUrls([])
        onProductUpdate?.()

        // Détection : reste-t-il d'autres pièces DEP non reçues pour ce trigramme ?
        if (target.trigramme) {
          const remainingDep = produits.filter(p =>
            p.id !== target.id &&
            p.source === 'deposante' &&
            p.trigramme === target.trigramme &&
            !p.recu &&
            p.statut !== 'supprime'
          )
          if (remainingDep.length === 0) {
            setBonDepotTrigramme(target.trigramme)
          }
        }
      } catch (err) {
        console.error('Erreur réception DEP:', err)
        alert('Erreur : réception non enregistrée')
      } finally {
        setReceptionSaving(false)
      }
    }

    const handleAddDefautPhotos = async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setReceptionUploading(true)
      try {
        const urls: string[] = []
        for (const file of Array.from(files)) {
          const url = await uploadToBunny(file)
          urls.push(url)
        }
        setReceptionDefautUrls(prev => [...prev, ...urls])
      } catch (e: any) {
        alert('Erreur upload photo : ' + (e?.message || ''))
      } finally {
        setReceptionUploading(false)
      }
    }

    const generateBonDepot = async () => {
      if (!bonDepotTrigramme) return
      setBonDepotGenerating(true)
      try {
        const idToken = await auth.currentUser?.getIdToken()
        const res = await fetch('/api/deposante/bon-depot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({ trigramme: bonDepotTrigramme, vendeusePrenom }),
        })
        const data = await res.json()
        if (!data.success) {
          alert('Erreur génération bon : ' + (data.error || 'inconnue'))
          return
        }
        alert(`Bon de dépôt envoyé à ${data.email || 'la déposante'} (${data.nbPieces || 0} pièce${(data.nbPieces || 0) > 1 ? 's' : ''})`)
        setBonDepotTrigramme(null)
      } catch (e: any) {
        alert('Erreur : ' + (e?.message || 'inconnue'))
      } finally {
        setBonDepotGenerating(false)
      }
    }

    const handleMarkNotReceived = async (p: Produit) => {
      if (processingIds.has(p.id)) return
      
      if (!confirm(`Supprimer "${p.sku || p.nom}" de la liste ?`)) return
      
      setProcessingIds((prev) => new Set(prev).add(p.id))

      try {
        // Retrait eBay best-effort AVANT le delete (pour ne pas perdre les ids)
        await fetch('/api/produits/remove-ebay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: p.id }),
        }).catch(() => {})
        await deleteDoc(doc(db, 'produits', p.id))
        onProductUpdate?.()
      } catch (err) {
        console.error('Erreur suppression:', err)
        alert('Erreur : FI')
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev)
          next.delete(p.id)
          return next
        })
      }
    }

    const handleMarkCollected = async (p: Produit) => {
      if (processingIds.has(p.id)) return
      setProcessingIds((prev) => new Set(prev).add(p.id))

      try {
        const res = await fetch('/api/delete-produits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: p.id,
            reason: 'valider_destock',
          }),
        })

        const data = await res.json()
        if (!data.success) {
          throw new Error(data.error || 'Erreur validation')
        }

        onProductUpdate?.()
      } catch (err: any) {
        console.error('Erreur récupération:', err)
        alert('Erreur : FI')
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev)
          next.delete(p.id)
          return next
        })
      }
    }

    const handleCancelDestock = async (p: Produit) => {
      if (processingIds.has(p.id)) return
      setProcessingIds((prev) => new Set(prev).add(p.id))

      try {
        await updateDoc(doc(db, 'produits', p.id), {
          statutRecuperation: null,
          dateDemandeRecuperation: null,
        })
        onProductUpdate?.()
      } catch (err) {
        console.error('Erreur annulation:', err)
        alert('Erreur : FI')
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev)
          next.delete(p.id)
          return next
        })
      }
    }

    const handleQuickEdit = async () => {
      if (!editTarget) return
      setProcessingIds((prev) => new Set(prev).add(editTarget.id))
      setUploadingPhotos(newPhotos.length > 0)

      try {
        const updates: Record<string, any> = {}
        if (editValues.prix !== undefined && editValues.prix !== '') {
          updates.prix = parseFloat(editValues.prix)
        }
        if (editValues.taille !== undefined) {
          updates.taille = editValues.taille
        }
        if (editValues.marque !== undefined) {
          updates.marque = editValues.marque
        }

        // Upload nouvelles photos vers Bunny
        if (newPhotos.length > 0) {
          const newUrls: string[] = []

          for (const file of newPhotos) {
            const url = await uploadToBunny(file)
            newUrls.push(url)
          }

          // Mettre à jour selon le format existant
          if (editTarget.photos) {
            const currentDetails = editTarget.photos.details || []
            
            if (!editTarget.photos.face && newUrls.length > 0) {
              updates.photos = {
                ...editTarget.photos,
                face: newUrls[0],
                details: [...currentDetails, ...newUrls.slice(1)]
              }
            } else {
              updates.photos = {
                ...editTarget.photos,
                details: [...currentDetails, ...newUrls]
              }
            }
            
            const existingUrls = getAllImages(editTarget)
            updates.imageUrls = [...existingUrls, ...newUrls]
            updates.imageUrl = updates.imageUrls[0] || ''
            
          } else {
            const existingUrls = editTarget.imageUrls || (editTarget.imageUrl ? [editTarget.imageUrl] : [])
            updates.imageUrls = [...existingUrls, ...newUrls]
            updates.imageUrl = updates.imageUrls[0] || ''
          }
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, 'produits', editTarget.id), updates)
        }

        setShowEditModal(false)
        setEditTarget(null)
        setEditValues({})
        setNewPhotos([])
        onProductUpdate?.()
      } catch (err) {
        console.error('Erreur édition:', err)
        alert('Erreur : FI')
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev)
          next.delete(editTarget?.id || '')
          return next
        })
        setUploadingPhotos(false)
      }
    }

    const openEditModal = (p: Produit) => {
      setEditTarget(p)
      setEditValues({
        prix: p.prix?.toString() || '',
        taille: p.taille || '',
        marque: p.marque || '',
      })
      setNewPhotos([])
      setShowEditModal(true)
    }

    const openSignalModal = (p: Produit) => {
      setSignalTarget(p)
      setSignalType('aRecuperer')
      setShowSignalModal(true)
    }

    const renderProductCard = (p: Produit, showChineuse = false) => {
      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      const allImages = getAllImages(p)
      const isProcessing = processingIds.has(p.id)
      const isFound = isProductFound(p)

      return (
        <div
          key={p.id}
          className={`bg-white rounded-xl border p-3 sm:p-4 shadow-sm transition-all ${
            isFound
              ? 'border-green-400 bg-green-50/50'
              : 'border-gray-200 hover:shadow-md'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {allImages.length > 0 ? (
                <img
                  src={allImages[0]}
                  alt={p.nom}
                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(allImages[0], '_blank')}
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 gap-1">
                  <ImageIcon size={20} className="text-gray-300" />
                  <span className="text-[9px] leading-tight text-center px-1">
                    {p.sku || '—'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                    {p.sku && <span className="text-[#22209C]">{p.sku}</span>}
                    {p.sku && ' - '}
                    {(p.nom || '').replace(new RegExp(`^${p.sku}\\s*-\\s*`, 'i'), '')}
                  </h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs sm:text-sm text-gray-500">
                    {p.marque && <span>{p.marque}</span>}
                    {p.taille && <span>T.{p.taille}</span>}
                    {cat && <span className="text-gray-400">{cat}</span>}
                  </div>
                  {showChineuse && (
                    <p className="text-xs text-gray-400 mt-1">{getChineurName(p.chineur)}</p>
                  )}
                  {mode === 'reception' && p.createdAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Déposé le {p.createdAt.toDate().toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-[#22209C] text-sm sm:text-base">
                    {typeof p.prix === 'number' ? `${p.prix} €` : '—'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Qté: <span className="font-medium">{p.quantite ?? 1}</span>
                  </p>
                  {isFound && (
                    <span className="text-[10px] text-green-600 flex items-center justify-end gap-1 mt-1">
                      <Check size={12} /> Trouvé
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {mode === 'inventaire' && (
                  <>
                    {isFound ? (
                      <button
                        onClick={() => handleUnmarkFound(p)}
                        disabled={isProcessing}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs sm:text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        Annuler
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkFound(p)}
                        disabled={isProcessing}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs sm:text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <Check size={14} />
                        <span className="hidden sm:inline">Trouvé</span>
                        <span className="sm:hidden">OK</span>
                      </button>
                    )}
                    <button
                      onClick={() => openSignalModal(p)}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs sm:text-sm hover:bg-amber-200 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      <AlertTriangle size={14} />
                      <span className="hidden sm:inline">Signaler</span>
                    </button>
                  </>
                )}

                {mode === 'reception' && (
                  <>
                    {(p as any).statutRestock === 'enAttente' ? (
                      <button
                        onClick={async () => {
                          const qteRestock = (p as any).quantiteRestock || 0
                          const nouvelleQte = (p.quantite ?? 0) + qteRestock
                          try {
                            await updateDoc(doc(db, 'produits', p.id), {
                              quantite: nouvelleQte,
                              statut: 'active',
                              vendu: false,
                              statutRestock: null,
                              quantiteRestock: null,
                              dateDemandeRestock: null,
                              dateRestock: Timestamp.now(),
                              restockParVendeuse: vendeusePrenom,
                            })
                          } catch (err) {
                            alert('Erreur : FI')
                          }
                        }}
                        disabled={isProcessing}
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs sm:text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <PackageCheck size={14} />
                        Reçu (+{(p as any).quantiteRestock})
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleMarkReceived(p)}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-none px-3 py-1.5 bg-[#22209C] text-white rounded-lg text-xs sm:text-sm hover:bg-[#1a1878] disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                        >
                          <PackageCheck size={14} />
                          Reçu
                        </button>
                        <button
                          onClick={() => handleMarkNotReceived(p)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs sm:text-sm hover:bg-red-200 disabled:opacity-50 transition-colors"
                        >
                          Non reçu
                        </button>
                      </>
                    )}
                  </>
                )}

                {mode === 'destock' && (
                  <>
                    {(p as any).statutDestock === 'enAttente' ? (
                      <>
                        <button
                          onClick={async () => {
                            const qteDestock = (p as any).quantiteDestock || 0
                            const nouvelleQte = Math.max(0, (p.quantite ?? 1) - qteDestock)
                            try {
                              await updateDoc(doc(db, 'produits', p.id), {
                                quantite: nouvelleQte,
                                statutDestock: null,
                                quantiteDestock: null,
                                dateDemandeDestock: null,
                                dateDestock: Timestamp.now(),
                                destockParVendeuse: vendeusePrenom,
                                ...(nouvelleQte === 0 ? { statut: 'outOfStock', dateRupture: Timestamp.now() } : {}),
                              })
                            } catch (err) {
                              alert('Erreur : FI')
                            }
                          }}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs sm:text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                        >
                          <Package size={14} />
                          Validé (-{(p as any).quantiteDestock})
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'produits', p.id), {
                                statutDestock: null,
                                quantiteDestock: null,
                                dateDemandeDestock: null,
                              })
                            } catch (err) {
                              alert('Erreur : FI')
                            }
                          }}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs sm:text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleMarkCollected(p)}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs sm:text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                        >
                          <Package size={14} />
                          Récupéré
                        </button>
                        <button
                          onClick={() => handleCancelDestock(p)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs sm:text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
                        >
                          Annuler
                        </button>
                      </>
                    )}
                  </>
                )}

                <button
                  onClick={() => openEditModal(p)}
                  disabled={isProcessing}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Modifier"
                >
                  <Edit3 size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
        </div>
      )
    }

    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="mb-4">
          <h1 className="text-lg sm:text-xl font-bold text-[#22209C]">
            {mode === 'inventaire' && `📋 Inventaire${inventaireNom ? ` - ${inventaireNom}` : ''}`}
            {mode === 'reception' && '📦 Réception'}
            {mode === 'destock' && '↩️ Déstockage'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Connectée en tant que <span className="font-medium">{vendeusePrenom}</span>
          </p>
        </div>

        {/* Stats avec sommes en € */}
        {mode === 'inventaire' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div
                className={`cursor-pointer rounded-lg p-2 -m-2 transition-colors ${filtreStatut === 'trouves' ? 'bg-green-100' : 'hover:bg-green-50'}`}
                onClick={() => setFiltreStatut(filtreStatut === 'trouves' ? 'tous' : 'trouves')}
              >
                <p className="text-2xl font-bold text-green-600">{stats.trouves}</p>
                <p className="text-xs text-gray-500">Trouvés</p>
                <p className="text-xs text-green-600 font-medium">{stats.sommeTrouves.toLocaleString('fr-FR')} €</p>
              </div>
              <div
                className={`cursor-pointer rounded-lg p-2 -m-2 transition-colors ${filtreStatut === 'nonTrouves' ? 'bg-amber-100' : 'hover:bg-amber-50'}`}
                onClick={() => setFiltreStatut(filtreStatut === 'nonTrouves' ? 'tous' : 'nonTrouves')}
              >
                <p className="text-2xl font-bold text-amber-600">{stats.restants}</p>
                <p className="text-xs text-gray-500">Restants</p>
                <p className="text-xs text-amber-600 font-medium">{stats.sommeRestants.toLocaleString('fr-FR')} €</p>
              </div>
            </div>
            
            {/* Indicateur filtre actif */}
            {filtreStatut !== 'tous' && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-2">
                <span className="text-xs text-gray-500">
                  Filtre actif : <span className="font-medium">{filtreStatut === 'trouves' ? 'Trouvés' : 'Non trouvés'}</span>
                </span>
                <button
                  onClick={() => setFiltreStatut('tous')}
                  className="text-xs text-[#22209C] hover:underline"
                >
                  Voir tous
                </button>
              </div>
            )}
          </div>
        )}

        {/* Recherche et filtres */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 shadow-sm">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="SKU, nom, marque..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
              />
              {recherche && (
                <button
                  onClick={() => setRecherche('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 border rounded-lg transition-colors ${
                showFilters || filtreCategorie || filtreDeposant || filtrePrix !== ''
                  ? 'border-[#22209C] bg-[#22209C]/5 text-[#22209C]'
                  : 'border-gray-200 text-gray-400 hover:text-gray-600'
              }`}
            >
              <Filter size={18} />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
              <select
                value={filtreDeposant}
                onChange={(e) => setFiltreDeposant(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
              >
                <option value="">Toutes chineuses</option>
                {deposantsUniques.map((tri, i) => (
                  <option key={i} value={tri}>
                    {getNomFromTri(tri).toUpperCase()}{tri ? ` · ${tri}` : ''}
                  </option>
                ))}
              </select>
              <select
                value={filtreCategorie}
                onChange={(e) => setFiltreCategorie(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
              >
                <option value="">Toutes catégories</option>
                {categoriesUniques.map((c, i) => (
                  <option key={i} value={c as string}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={filtrePrix}
                onChange={(e) => setFiltrePrix(e.target.value)}
                placeholder="Prix exact"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
  />
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2">
            {produitsFiltres.length} produit(s)
          </p>
        </div>

        {/* Liste des produits */}
        {produitsParChineuse ? (
          <div className="space-y-6">
            {Object.entries(produitsParChineuse)
              .sort(([a], [b]) => getNomFromTri(a).localeCompare(getNomFromTri(b), 'fr'))
              .map(([tri, prods]) => {
                const chineuseNonTrouves = mode === 'inventaire' ? prods.filter(p => !isProductFound(p)).length : 0
                const chineuseTrouves = mode === 'inventaire' ? prods.filter(p => isProductFound(p)).length : 0

                return (
                  <div key={tri}>
                    <h2 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                      <span>{getNomFromTri(tri)}{tri && tri !== 'SANS-TRI' ? ` · ${tri}` : ''}</span>
                      {mode === 'inventaire' ? (
                        <>
                          <span className="text-xs font-normal text-gray-400">
                            ({chineuseTrouves}/{prods.length})
                          </span>
                          {chineuseNonTrouves > 0 && (
                            <span className="text-xs font-normal text-amber-600">
                              • {chineuseNonTrouves} restant{chineuseNonTrouves > 1 ? 's' : ''}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs font-normal text-gray-400">
                          ({prods.length})
                        </span>
                      )}
                    </h2>
                    <div className="space-y-2">
                      {prods.map((p) => renderProductCard(p, false))}
                    </div>
                  </div>
                )
              })}
          </div>
        ) : (
          <div className="space-y-2">
            {produitsFiltres.slice(0, visibleCount).map((p) => renderProductCard(p, true))}
          </div>
        )}

        {/* Loader infinite scroll */}
        {visibleCount < produitsFiltres.length && (
          <div ref={loaderRef} className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
          </div>
        )}

        {produitsFiltres.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400">
              {mode === 'reception' && 'Aucun produit en attente de réception'}
              {mode === 'destock' && 'Aucun produit à récupérer'}
              {mode === 'inventaire' && filtreStatut === 'nonTrouves' && '🎉 Tous les produits ont été trouvés !'}
              {mode === 'inventaire' && filtreStatut === 'trouves' && 'Aucun produit trouvé pour le moment'}
              {mode === 'inventaire' && filtreStatut === 'tous' && 'Aucun produit trouvé'}
            </p>
          </div>
        )}

        {/* Modal Signaler */}
        {showSignalModal && signalTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-sm w-full p-5">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">Signaler un problème</h3>
              <p className="text-sm text-gray-500 mb-4">
                {signalTarget.sku || signalTarget.nom}
              </p>

              <div className="space-y-2 mb-4">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="signalType"
                    checked={signalType === 'aRecuperer'}
                    onChange={() => setSignalType('aRecuperer')}
                    className="text-[#22209C]"
                  />
                  <div>
                    <p className="font-medium text-sm">À récupérer</p>
                    <p className="text-xs text-gray-400">La chineuse doit venir le chercher</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="signalType"
                    checked={signalType === 'vole'}
                    onChange={() => setSignalType('vole')}
                    className="text-[#22209C]"
                  />
                  <div>
                    <p className="font-medium text-sm">Volé</p>
                    <p className="text-xs text-gray-400">Produit disparu/volé</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSignalModal(false)
                    setSignalTarget(null)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSignal}
                  disabled={processingIds.has(signalTarget.id)}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  Signaler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Édition */}
        {showEditModal && editTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-sm w-full p-5 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Modifier</h3>

              {/* Photos existantes */}
              {getAllImages(editTarget).length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                  {getAllImages(editTarget).map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Photo ${idx + 1}`}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80 border"
                      onClick={() => window.open(url, '_blank')}
                    />
                  ))}
                </div>
              )}

              {/* Nouvelles photos à ajouter */}
              {newPhotos.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                  {newPhotos.map((file, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Nouvelle ${idx + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border-2 border-green-400"
                      />
                      <button
                        type="button"
                        onClick={() => setNewPhotos(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Boutons ajout photo */}
              <div className="flex gap-2 mb-4">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setNewPhotos(prev => [...prev, file])
                    e.target.value = ''
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-100 transition text-sm"
                >
                  <Camera size={18} />
                  Photo
                </button>
                <label className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition cursor-pointer text-sm">
                  <Upload size={18} />
                  Fichier
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length > 0) setNewPhotos(prev => [...prev, ...files])
                      e.target.value = ''
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Prix (€)</label>
                  <input
                    type="number"
                    value={editValues.prix || ''}
                    onChange={(e) => setEditValues({ ...editValues, prix: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
                    placeholder="Prix"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Taille</label>
                  <input
                    type="text"
                    value={editValues.taille || ''}
                    onChange={(e) => setEditValues({ ...editValues, taille: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
                    placeholder="Taille"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Marque</label>
                  <input
                    type="text"
                    value={editValues.marque || ''}
                    onChange={(e) => setEditValues({ ...editValues, marque: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
                    placeholder="Marque"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditTarget(null)
                    setEditValues({})
                    setNewPhotos([])
                  }}
                  disabled={uploadingPhotos}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleQuickEdit}
                  disabled={processingIds.has(editTarget.id) || uploadingPhotos}
                  className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm hover:bg-[#1a1878] disabled:opacity-50 transition-colors"
                >
                  {uploadingPhotos ? '📤 Upload...' : processingIds.has(editTarget.id) ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modale réception déposante : note + photos défauts */}
        {receptionTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-1 text-[#22209C]">Réception du dépôt</h3>
              <p className="text-sm text-gray-500 mb-4">
                <strong>{receptionTarget.sku || receptionTarget.nom}</strong>
                {receptionTarget.trigramme ? ` · ${receptionTarget.trigramme}` : ''}
              </p>

              <label className="block text-xs font-medium text-gray-600 mb-1">Note de réception (optionnel)</label>
              <textarea
                value={receptionNote}
                onChange={e => setReceptionNote(e.target.value)}
                placeholder="Ex : petite tache au col, doublure décousue…"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#22209C]/20"
              />

              <label className="block text-xs font-medium text-gray-600 mb-1">Photos des défauts (optionnel)</label>
              {receptionDefautUrls.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {receptionDefautUrls.map((url, idx) => (
                    <div key={idx} className="relative">
                      <img src={url} alt={`Défaut ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => setReceptionDefautUrls(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center justify-center gap-2 py-2 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-100 transition cursor-pointer text-sm mb-4">
                <Camera size={18} />
                {receptionUploading ? 'Upload…' : 'Ajouter une photo'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleAddDefautPhotos(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>

              <div className="flex gap-3">
                <button
                  onClick={() => { setReceptionTarget(null); setReceptionNote(''); setReceptionDefautUrls([]) }}
                  disabled={receptionSaving || receptionUploading}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmReceptionDep}
                  disabled={receptionSaving || receptionUploading}
                  className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm hover:bg-[#1a1878] disabled:opacity-50"
                >
                  {receptionSaving ? '...' : 'Confirmer réception'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Popup : restock chineuse fini — phase A (pièces à gérer) puis phase B (photos face à valider) */}
        {restockFiniChineuse && (() => {
          const tri = restockFiniChineuse.trigramme
          const now = new Date()
          const oneMonthAgo = new Date(now); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
          const twoMonthsAgo = new Date(now); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
          const pieces = produits.filter(p =>
            getTri(p) === tri &&
            p.statut !== 'supprime' && p.statut !== 'vendu' && p.statut !== 'retour' &&
            p.vendu !== true
          )
          const aRecuperer = pieces.filter(p => {
            if (p.statutRecuperation === 'aRecuperer') return true
            const baisse = (p as any).prixBaisseLe?.toDate?.()
            return baisse instanceof Date && baisse < oneMonthAgo
          })
          const prixABaisser = pieces.filter(p => {
            if (p.statutRecuperation === 'aRecuperer') return false
            const baisse = (p as any).prixBaisseLe?.toDate?.()
            if (baisse instanceof Date) return false
            const dr = (p as any).dateReception?.toDate?.()
            return dr instanceof Date && dr < twoMonthsAgo
          })
          const aGerer = [
            ...aRecuperer.map(p => ({ p, kind: 'red' as const })),
            ...prixABaisser.map(p => ({ p, kind: 'orange' as const })),
          ]

          if (aGerer.length > 0) {
            // Phase A — pièces à gérer
            return (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-2 text-[#22209C]">
                    Bravo pr le restock beautey 🦾
                  </h3>
                  <p className="text-sm text-gray-700 mb-4">
                    Il faut encore gérer {aGerer.length} pièce{aGerer.length > 1 ? 's' : ''} de <strong>{restockFiniChineuse.nom}</strong> :
                  </p>
                  <ul className="text-sm text-gray-800 mb-5 space-y-1.5">
                    {aGerer.map(({ p, kind }) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${kind === 'red' ? 'bg-red-500' : 'bg-orange-400'}`} />
                        <span className="font-mono text-xs text-gray-500">{p.sku}</span>
                        <span className="truncate">{(p.nom || '').replace(`${p.sku || ''} - `, '')}</span>
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                          {kind === 'red' ? 'à récupérer' : 'à baisser'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setRestockFiniChineuse(null)}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Plus tard
                    </button>
                    <button
                      onClick={() => {
                        setRestockFiniChineuse(null)
                        router.push(`/vendeuse/produits?chineuse=${encodeURIComponent(tri)}`)
                      }}
                      className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm hover:bg-[#1a1878]"
                    >
                      Gérer
                    </button>
                  </div>
                </div>
              </div>
            )
          }

          // Phase B — défilement des photos face une par une
          const photosACheck = pieces
            .filter(p => (p.photos?.face || p.imageUrls?.[0] || p.imageUrl))
            .sort((a, b) => extractSkuNumber(a.sku) - extractSkuNumber(b.sku))

          if (photosACheck.length === 0) {
            return (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-md w-full p-6">
                  <h3 className="text-lg font-semibold mb-2 text-[#22209C]">Tout est OK 💙</h3>
                  <p className="text-sm text-gray-700 mb-5">
                    Restock de <strong>{restockFiniChineuse.nom}</strong> terminé, aucune pièce à valider.
                  </p>
                  <button
                    onClick={() => setRestockFiniChineuse(null)}
                    className="w-full px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm hover:bg-[#1a1878]"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )
          }

          // Phase C — grille finale : elle choisit ses pièces préférées → coups-de-coeur
          if (restockShowGrid) {
            const toggleFav = async (p: Produit) => {
              if (favTogglingId) return
              setFavTogglingId(p.id)
              try {
                const wasFav = (p as any).favoriEquipe === true
                await updateDoc(doc(db, 'produits', p.id), {
                  favoriEquipe: !wasFav,
                  likesCount: increment(wasFav ? -1 : 1),
                })
                onProductUpdate?.()
              } catch (err: any) {
                console.error('Erreur toggle favori équipe:', err)
                alert(err.message || 'Erreur favori')
              } finally {
                setFavTogglingId(null)
              }
            }
            const closeAll = () => {
              setRestockShowGrid(false)
              setRestockFiniChineuse(null)
              setRestockPhotoIndex(0)
            }
            const favoriteProducts = photosACheck.filter(p => (p as any).favoriEquipe === true)
            const publishAllFavorites = async () => {
              if (igPublishingId || favoriteProducts.length === 0) return
              const igOk: string[] = []
              const fbOk: string[] = []
              const failures: string[] = []
              for (const p of favoriteProducts) {
                setIgPublishingId(p.id)
                try {
                  const igRes = await fetch('/api/instagram/publish-story', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: p.id }),
                  })
                  const igData = await igRes.json()
                  if (igData.success) igOk.push(p.sku || p.id)
                  else failures.push(`${p.sku}: IG ${igData.error || 'erreur'}`)

                  const fbRes = await fetch('/api/facebook/publish-post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: p.id }),
                  })
                  const fbData = await fbRes.json()
                  if (fbData.success) fbOk.push(p.sku || p.id)
                  else failures.push(`${p.sku}: FB ${fbData.error || 'erreur'}`)
                } catch (err: any) {
                  failures.push(`${p.sku}: ${err?.message || 'erreur réseau'}`)
                }
              }
              setIgPublishingId(null)
              onProductUpdate?.()
              const lines = [
                `${igOk.length}/${favoriteProducts.length} stories IG publiées ✅`,
                `${fbOk.length}/${favoriteProducts.length} posts FB publiés ✅`,
                favoriteProducts.length > 0 && '\nPense à ajouter le sticker "Lien" sur chaque story IG si tu veux qu\'elle soit cliquable.',
                failures.length > 0 && `\nErreurs :\n${failures.join('\n')}`,
              ].filter(Boolean).join('\n')
              alert(lines)
              closeAll()
            }
            return (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-2xl w-full p-5 max-h-[95vh] overflow-y-auto flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#22209C]">
                        Tes pièces préférées de {restockFiniChineuse.nom} 💙
                      </h3>
                      <p className="text-xs text-gray-500">
                        Tape sur celles que tu adores — elles iront dans « Nos pièces préférées ».
                      </p>
                    </div>
                    <button onClick={closeAll} className="text-gray-400 hover:text-gray-600" aria-label="Fermer">
                      <X size={22} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {photosACheck.map((p) => {
                      const face = p.photos?.face || p.imageUrls?.[0] || p.imageUrl || ''
                      const isFav = (p as any).favoriEquipe === true
                      const busy = favTogglingId === p.id
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleFav(p)}
                          disabled={busy}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            isFav ? 'border-[#22209C] ring-2 ring-[#22209C]/30' : 'border-gray-200 hover:border-gray-300'
                          } ${busy ? 'opacity-60' : ''}`}
                        >
                          <img src={face} alt={p.nom} className="w-full h-full object-cover" />
                          {isFav && (
                            <span className="absolute top-1 right-1 bg-[#22209C] text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shadow">
                              <Check size={14} />
                            </span>
                          )}
                          <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] font-mono py-0.5 text-center">
                            {p.sku}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {favoriteProducts.length > 0 && (
                    <button
                      onClick={publishAllFavorites}
                      disabled={!!igPublishingId}
                      className="w-full mb-2 px-4 py-2.5 bg-gradient-to-r from-[#E1306C] to-[#833AB4] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
                    >
                      {igPublishingId
                        ? `Publication en cours…`
                        : `Publier ${favoriteProducts.length} pièce${favoriteProducts.length > 1 ? 's' : ''} sur IG story + FB`}
                    </button>
                  )}
                  <button
                    onClick={closeAll}
                    disabled={!!igPublishingId}
                    className="w-full px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    Terminer sans publier
                  </button>
                </div>
              </div>
            )
          }

          const idx = Math.min(restockPhotoIndex, photosACheck.length - 1)
          const current = photosACheck[idx]
          const currentFace = current.photos?.face || current.imageUrls?.[0] || current.imageUrl || ''
          const goNext = () => {
            if (idx + 1 >= photosACheck.length) {
              // Fin du carousel → passe à la grille "pièces préférées"
              setRestockShowGrid(true)
              setRestockPhotoIndex(0)
            } else {
              setRestockPhotoIndex(idx + 1)
            }
          }
          const genererPorte = async () => {
            if (!currentFace) return
            setGeneratingPorteId(current.id)
            try {
              const cat = typeof current.categorie === 'object' ? current.categorie?.label : current.categorie || ''
              const res = await fetch('/api/generate-tryon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageUrl: currentFace,
                  productName: current.nom,
                  gender: 'female',
                  categorie: cat,
                  matiere: current.material || '',
                  view: 'front',
                  seed: Math.floor(Math.random() * 4294967295),
                }),
              })
              const data = await res.json()
              if (!data.success || !data.onModelUrl) throw new Error(data.error || 'Erreur génération')
              const currentImages = getAllImages(current)
              const newUrls = currentImages.includes(data.onModelUrl) ? currentImages : [...currentImages, data.onModelUrl]
              await updateDoc(doc(db, 'produits', current.id), {
                'photos.faceOnModel': data.onModelUrl,
                imageUrls: newUrls,
                imageUrl: newUrls[0],
              })
              onProductUpdate?.()
            } catch (err: any) {
              console.error('Erreur génération porté:', err)
              alert(err.message || 'Erreur génération porté')
            } finally {
              setGeneratingPorteId(null)
            }
          }

          return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl max-w-lg w-full p-5 max-h-[95vh] overflow-y-auto flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#22209C]">
                      Photos {restockFiniChineuse.nom} · {tri}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {idx + 1} / {photosACheck.length} · <span className="font-mono">{current.sku}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => { setRestockFiniChineuse(null); setRestockPhotoIndex(0) }}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Fermer"
                  >
                    <X size={22} />
                  </button>
                </div>
                <img
                  src={currentFace}
                  alt={current.nom}
                  className="w-full aspect-square object-contain bg-gray-50 rounded-lg mb-3"
                />
                <p className="text-sm text-gray-700 mb-3 truncate">{(current.nom || '').replace(`${current.sku || ''} - `, '')}</p>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => { openEditModal(current) }}
                    className="flex-1 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
                  >
                    Pas OK
                  </button>
                  <button
                    onClick={genererPorte}
                    disabled={generatingPorteId === current.id}
                    className="flex-1 px-3 py-2 border border-[#22209C]/30 text-[#22209C] rounded-lg text-sm hover:bg-[#22209C]/5 disabled:opacity-50"
                  >
                    {generatingPorteId === current.id ? 'Génération…' : 'Générer porté'}
                  </button>
                  <button
                    onClick={goNext}
                    className="flex-1 px-3 py-2 bg-[#22209C] text-white rounded-lg text-sm hover:bg-[#1a1878]"
                  >
                    OK →
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Popup : toutes les pièces DEP de ce trigramme reçues → générer le bon de dépôt */}
        {bonDepotTrigramme && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-2 text-[#22209C]">Dépôt complet 💙</h3>
              <p className="text-sm text-gray-700 mb-4">
                Toutes les pièces de <strong>{bonDepotTrigramme}</strong> sont réceptionnées.
                Voulez-vous générer le bon de dépôt et l'envoyer par email à la déposante ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setBonDepotTrigramme(null)}
                  disabled={bonDepotGenerating}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Plus tard
                </button>
                <button
                  onClick={generateBonDepot}
                  disabled={bonDepotGenerating}
                  className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm hover:bg-[#1a1878] disabled:opacity-50"
                >
                  {bonDepotGenerating ? 'Envoi…' : 'Générer le bon'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }