  // components/ProductForm.tsx
  'use client'

  import { useState, useEffect, useRef } from 'react'
  import { X, Image as ImageIcon, Upload, RefreshCw, FileSpreadsheet, Download, Camera } from 'lucide-react'
  import PhotoEditor from '@/components/PhotoEditor'
  import ExcelJS from 'exceljs'
  import * as XLSX from 'xlsx'
  import { checkSkuUnique, getNextAvailableSkuForTrigramme } from '@/lib/admin/helpers'
  import { getTaillesPourCategorie, detectTypeTaille, ALL_TAILLES } from '@/lib/tailles'
  import { COLOR_PALETTE } from '@/lib/couleurs'
  import { getMatieresForCategorie, ALL_MATIERES } from '@/lib/matieres'

  // Conversion base64 robuste pour gros fichiers
  function uint8ArrayToBase64(uint8Array: Uint8Array): string {
    const CHUNK_SIZE = 0x8000 // 32KB chunks
    const chunks: string[] = []
    for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
      const chunk = uint8Array.subarray(i, i + CHUNK_SIZE)
      chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]))
    }
    return btoa(chunks.join(''))
  }

  // Compresser l'image avant envoi (max ~1.5MB)
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      let { width, height } = img
      const maxDim = 1600
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim
          width = maxDim
        } else {
          width = (width / height) * maxDim
          height = maxDim
        }
      }
      
      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)
      
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

  // =====================
  // GUIDE PHOTO MODAL
  // =====================
  const GUIDE_KEY = 'photoGuideLastSeen'
  const GUIDE_DELAY = 24 * 60 * 60 * 1000 // 24h

  function PhotoGuideModal() {
    const [show, setShow] = useState(false)

    useEffect(() => {
      const lastSeen = localStorage.getItem(GUIDE_KEY)
      if (!lastSeen || Date.now() - parseInt(lastSeen) > GUIDE_DELAY) {
        setShow(true)
      }
    }, [])

    const handleClose = () => {
      localStorage.setItem(GUIDE_KEY, Date.now().toString())
      setShow(false)
    }

    if (!show) return null

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
          <h2 className="text-lg font-bold text-[#22209C] mb-4 flex items-center gap-2">
            📸 Guide photo
          </h2>
          
          <p className="text-sm text-gray-600 mb-4">
            Pour un détourage optimal, vos photos doivent respecter ces critères :
          </p>
          
          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-sm"><strong>Fond uni</strong> — mur blanc, drap, sol neutre</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-sm"><strong>Pas de main visible</strong> — utilisez un cintre ou posez le vêtement</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-sm"><strong>Étiquette prix retirée</strong> — ou masquée derrière le vêtement</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-sm"><strong>Produit entier visible</strong> — ne coupez pas les bords</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-sm"><strong>Veste/manteau fermé</strong> — boutonnez ou zippez le vêtement</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-sm"><strong>Bonne luminosité</strong> — évitez les zones sombres</span>
            </li>
          </ul>
          
          <button
            onClick={handleClose}
            className="w-full bg-[#22209C] text-white py-3 rounded-lg font-semibold hover:opacity-90 transition"
          >
            ✓ C'est compris
          </button>
        </div>
      </div>
    )
  }

  // =====================
  // PHOTO REORDER COMPONENT
  // =====================
  type PhotoItem = {
    id: string
    url: string
    type: 'face' | 'faceOnModel' | 'dos' | 'detail'
    label: string
    isNew?: boolean
    file?: File
  }

  function PhotoReorderSection({
    photos,
    onReorder,
  }: {
    photos: PhotoItem[]
    onReorder: (newOrder: PhotoItem[]) => void
  }) {
    if (photos.length < 2) return null

    const movePhoto = (index: number, direction: 'up' | 'down') => {
      const newPhotos = [...photos]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      
      if (targetIndex < 0 || targetIndex >= photos.length) return
      
      // Swap
      [newPhotos[index], newPhotos[targetIndex]] = [newPhotos[targetIndex], newPhotos[index]]
      onReorder(newPhotos)
    }

    return (
      <div className="mt-4 pt-4 border-t">
        <label className="block text-xs font-medium text-gray-700 mb-2">
          📐 Ordre d'affichage <span className="font-normal text-gray-500">(la 1ère = photo principale)</span>
        </label>
        <div className="space-y-2">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className={`flex items-center gap-3 p-2 rounded-lg border ${
                index === 0 ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'
              }`}
            >
              {/* Position */}
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                index === 0 ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                {index + 1}
              </span>
              
              {/* Thumbnail */}
              <img
                src={photo.url}
                alt={photo.label}
                className="w-12 h-12 object-cover rounded border"
              />
              
              {/* Label */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-700">{photo.label}</span>
                {photo.isNew && (
                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                    Nouveau
                  </span>
                )}
                {index === 0 && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    Photo principale
                  </span>
                )}
              </div>
              
              {/* Arrows */}
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => movePhoto(index, 'up')}
                  disabled={index === 0}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Monter"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => movePhoto(index, 'down')}
                  disabled={index === photos.length - 1}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Descendre"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // =====================
  // TYPES
  // =====================
  type Cat = { label: string; idsquare?: string }

  type Chineuse = {
    uid: string
    nom: string
    email: string
    trigramme: string
    categories: Cat[]
  }

  // Photos existantes (URLs) - pour édition
  type ExistingPhotos = {
    face?: string
    faceOnModel?: string
    dos?: string
    details?: string[]
  }

  // Données du formulaire
  type ProductFormData = {
    nom: string
    description: string
    categorie: string
    prix: string
    quantite: string
    marque: string
    taille: string
    material: string
    color: string
    madeIn: string
    sku?: string
    // Nouvelles photos (File)
    photoFace: File | null
    photoDos: File | null
    photosDetails: File[]
    // Photos existantes conservées (pour édition)
    existingPhotos: ExistingPhotos
    // Photos existantes supprimées (pour édition)
    deletedPhotos: {
      face?: boolean
      faceOnModel?: boolean
      dos?: boolean
      detailsIndexes?: number[]
    }
    // Ordre des photos pour l'affichage
    photoOrder?: PhotoItem[]
  }

  // Données d'import Excel
  type ExcelImportData = {
    nom: string
    categorie: string
    prix: number
    quantite: number
    marque: string
    taille: string
    material: string
    color: string
    description: string
    madeIn: string
    sku?: string
  }

  type ProductFormProps = {
    // Mode
    mode: 'create' | 'edit'
    isAdmin?: boolean
    productId?: string  // Pour édition, permet de garder le même SKU
    
    // Pour admin : liste des chineuses
    chineuses?: Chineuse[]
    selectedChineuse?: Chineuse | null
    onChineuseChange?: (chineuse: Chineuse | null) => void
    
    // Pour chineuse : ses catégories
    categories?: Cat[]
    
    // SKU (readonly)
    sku?: string
    
    // Nom utilisateur (pour le template)
    userName?: string
    
    // Trigramme (pour l'import)
    trigramme?: string
    
    // Données initiales (pour édition)
    initialData?: {
      nom?: string
      description?: string
      categorie?: string
      prix?: string
      quantite?: string
      marque?: string
      taille?: string
      material?: string
      color?: string
      madeIn?: string
      sku?: string
      photos?: ExistingPhotos
    }
    
    // Callbacks
    onSubmit: (data: ProductFormData) => Promise<void>
    onExcelImport?: (produits: ExcelImportData[]) => Promise<void>
    onCancel?: () => void
    
    // État
    loading?: boolean
    submitLabel?: string
    
    // Options
    showExcelImport?: boolean
  }

  // =====================
  // TAILLES
  // =====================
  const MADE_IN_OPTIONS = ['', 'Made in France', 'Made in Italy', 'Made in USA', 'Made in UK', 'Made in Spain', 'Made in Germany', 'Made in Japan']


  // =====================
  // EXCEL HELPERS
  // =====================
  const normalizeKey = (key: string) =>
    key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')

  const aliasMap: Record<string, string[]> = {
    nom: ['nom', 'nomdelarticle', 'nomarticle', 'titre', 'article', 'produit'],
    categorie: ['categorie', 'categories', 'catégorie', 'cat'],
    prix: ['prix', 'prixttc', 'tarif', 'prixeur', 'prixe'],
    description: ['description', 'desc', 'details', 'détails'],
    quantite: ['quantite', 'quantitestock', 'qty', 'quantité', 'qte', 'stock'],
    sku: ['sku', 'ref', 'reference', 'référence', 'code'],
    marque: ['marque', 'brand', 'marques', 'griffe'],
    taille: ['taille', 'size', 'pointure', 't'],
    material: ['matiere', 'matière', 'material', 'composition', 'tissu'],
    color: ['couleur', 'color', 'coloris', 'teinte'],
    madeIn: ['madein', 'fabrication', 'origine', 'fabriqueen', 'pays'],
  }

  const getAliasKey = (key: string): string | null => {
    const normalized = normalizeKey(key)
    for (const target in aliasMap) {
      if (aliasMap[target].some(a => normalizeKey(a) === normalized)) {
        return target
      }
    }
    return null
  }

  // =====================
  // COMPONENT
  // =====================
  export default function ProductForm({
    mode,
    isAdmin = false,
    productId,
    chineuses = [],
    selectedChineuse,
    onChineuseChange,
    categories = [],
    sku = '',
    userName = '',
    trigramme = '',
    initialData,
    onSubmit,
    onExcelImport,
    onCancel,
    loading = false,
    submitLabel,
    showExcelImport = true,
  }: ProductFormProps) {
    
    // Refs pour les inputs caméra
    const cameraFaceRef = useRef<HTMLInputElement>(null)
    const cameraDosRef = useRef<HTMLInputElement>(null)
    const cameraDetailsRef = useRef<HTMLInputElement>(null)
    
    // État du formulaire
    const [formData, setFormData] = useState<ProductFormData>({
      nom: initialData?.nom || '',
      description: initialData?.description || '',
      categorie: initialData?.categorie || '',
      prix: initialData?.prix || '',
      quantite: initialData?.quantite || '1',
      marque: initialData?.marque || '',
      taille: initialData?.taille || '',
      material: initialData?.material || '',
      color: initialData?.color || '',
      madeIn: initialData?.madeIn || '',
      sku: initialData?.sku || '',
      photoFace: null,
      photoDos: null,
      photosDetails: [],
      existingPhotos: initialData?.photos || {},
      deletedPhotos: { detailsIndexes: [] },
    })

    // État Excel import
    const [showExcelSection, setShowExcelSection] = useState(false)
    const [excelFile, setExcelFile] = useState<File | null>(null)
    const [importLoading, setImportLoading] = useState(false)
    
    // État validation SKU
    const [skuValidating, setSkuValidating] = useState(false)
    const [nextAvailableSku, setNextAvailableSku] = useState<string>('')

    // État éditeur photo
    const [photoToEdit, setPhotoToEdit] = useState<{ file: File; type: 'face' | 'dos' } | null>(null)
    const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null)

    // URLs des photos détourées (prêtes à enregistrer)
    const [detouredFaceUrl, setDetouredFaceUrl] = useState<string | null>(null)
    const [detouredDosUrl, setDetouredDosUrl] = useState<string | null>(null)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [generatingDesc, setGeneratingDesc] = useState(false)
    const [deletePhotoConfirm, setDeletePhotoConfirm] = useState<{type: 'face' | 'faceOnModel' | 'dos' | 'detail', index?: number} | null>(null)
    const [suggestedDesc, setSuggestedDesc] = useState<{fr: string, en: string} | null>(null)
    // État pour l'ordre des photos
  const [photoOrder, setPhotoOrder] = useState<PhotoItem[]>([])

    // Réinitialiser le formulaire quand initialData change
    useEffect(() => {
      if (initialData) {
        setFormData({
          nom: initialData.nom || '',
          description: initialData.description || '',
          categorie: initialData.categorie || '',
          prix: initialData.prix || '',
          quantite: initialData.quantite || '1',
          marque: initialData.marque || '',
          taille: initialData.taille || '',
          material: initialData.material || '',
          color: initialData.color || '',
          madeIn: initialData.madeIn || '',
          sku: initialData.sku || '',
          photoFace: null,
          photoDos: null,
          photosDetails: [],
          existingPhotos: initialData.photos || {},
          deletedPhotos: { detailsIndexes: [] },
        })
      }
    }, [initialData])

    // Reset taille quand catégorie change
    const [initialized, setInitialized] = useState(false)
    useEffect(() => {
      if (!initialized) {
        setInitialized(true)
        return
      }
      if (formData.categorie && initialData?.categorie !== formData.categorie) {
        setFormData(prev => ({ ...prev, taille: '' }))
      }
    }, [formData.categorie])

    // Charger le prochain SKU disponible
    useEffect(() => {
      const loadNextSku = async () => {
        const tri = isAdmin && selectedChineuse ? selectedChineuse.trigramme : trigramme
        if (tri) {
          const next = await getNextAvailableSkuForTrigramme(tri)
          setNextAvailableSku(next)
        }
      }
      loadNextSku()
    }, [trigramme, selectedChineuse, isAdmin])

    // Construire la liste des photos pour le réordonnancement
    useEffect(() => {
      const items: PhotoItem[] = []
      
      // Photos existantes
      if (formData.existingPhotos.face && !formData.deletedPhotos.face) {
        items.push({ id: 'existing-face', url: formData.existingPhotos.face, type: 'face', label: 'Face' })
      }
      if (formData.existingPhotos.faceOnModel && !formData.deletedPhotos.faceOnModel) {
        items.push({ id: 'existing-faceOnModel', url: formData.existingPhotos.faceOnModel, type: 'faceOnModel', label: 'Portée' })
      }
      if (formData.existingPhotos.dos && !formData.deletedPhotos.dos) {
        items.push({ id: 'existing-dos', url: formData.existingPhotos.dos, type: 'dos', label: 'Dos' })
      }
      (formData.existingPhotos.details || []).forEach((url, i) => {
        if (!isDetailDeleted(i)) {
          items.push({ id: `existing-detail-${i}`, url, type: 'detail', label: `Détail ${i + 1}` })
        }
      })
      
      // Nouvelles photos
      if (formData.photoFace) {
        items.push({ id: 'new-face', url: URL.createObjectURL(formData.photoFace), type: 'face', label: 'Face', isNew: true, file: formData.photoFace })
      }
      if (formData.photoDos) {
        items.push({ id: 'new-dos', url: URL.createObjectURL(formData.photoDos), type: 'dos', label: 'Dos', isNew: true, file: formData.photoDos })
      }
      formData.photosDetails.forEach((file, i) => {
        items.push({ id: `new-detail-${i}`, url: URL.createObjectURL(file), type: 'detail', label: `Détail (nouveau ${i + 1})`, isNew: true, file })
      })
      
      // Conserver l'ordre existant si possible
      if (photoOrder.length > 0) {
        const orderedItems: PhotoItem[] = []
        const remainingItems = [...items]
        
        photoOrder.forEach(orderedPhoto => {
          const index = remainingItems.findIndex(item => item.id === orderedPhoto.id)
          if (index !== -1) {
            orderedItems.push(remainingItems[index])
            remainingItems.splice(index, 1)
          }
        })
        
        // Ajouter les nouvelles photos à la fin
        orderedItems.push(...remainingItems)
        setPhotoOrder(orderedItems)
      } else {
        setPhotoOrder(items)
      }
    }, [
      formData.existingPhotos,
      formData.deletedPhotos,
      formData.photoFace,
      formData.photoDos,
      formData.photosDetails,
    ])

    const typeTaille = detectTypeTaille(formData.categorie)
    const taillesDisponibles = getTaillesPourCategorie(formData.categorie)
    const matieresDisponibles = getMatieresForCategorie(formData.categorie)

    // Catégories à afficher
    const displayCategories = isAdmin && selectedChineuse 
      ? selectedChineuse.categories 
      : categories

    // =====================
    // CAMERA HANDLERS
    // =====================
    const handleCameraCapture = async (type: 'face' | 'dos' | 'details', file: File) => {
      if (type === 'face' || type === 'dos') {
        try {
          // Upload vers Bunny
          setUploadingPhoto(true)
          const base64 = await compressImage(file)
          const timestamp = Date.now()
          const random = Math.random().toString(36).substring(2, 8)
          const path = `produits/temp_${timestamp}_${random}.jpg`
          
          const response = await fetch('/api/detourage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, uploadOnly: true })
          })
          const data = await response.json()

          if (!data.success) {
            throw new Error(data.error || 'Erreur upload')
          }

          setUploadedPhotoUrl(data.maskUrl)
          setPhotoToEdit({ file, type })
      } catch (err) {
          console.error('Erreur upload:', err)
          alert('Erreur upload photo')
        } finally {
          setUploadingPhoto(false)
        }
      } else if (type === 'details') {
        // Formatter en carré 1200x1200 avant d'ajouter
        try {
          setUploadingPhoto(true)
          const base64 = await compressImage(file)
          
          const response = await fetch('/api/detourage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, skipDetourage: true, mode: 'erased' })
          })
          const data = await response.json()
          
          if (data.success && data.maskUrl) {
            setFormData(prev => ({
              ...prev,
              existingPhotos: {
                ...prev.existingPhotos,
                details: [...(prev.existingPhotos.details || []), data.maskUrl]
              }
            }))
          } else {
            throw new Error(data.error || 'Erreur formatage')
          }
        } catch (err) {
          console.error('Erreur formatage détail:', err)
          alert('Erreur formatage photo détail')
        } finally {
          setUploadingPhoto(false)
        }
      }
    }

    const handlePhotoEditorConfirm = async (processedUrl: string) => {
      if (photoToEdit) {
        if (photoToEdit.type === 'face') {
          setDetouredFaceUrl(processedUrl)
          setFormData(prev => ({
            ...prev,
            existingPhotos: { ...prev.existingPhotos, face: processedUrl },
            photoFace: null,
            deletedPhotos: { ...prev.deletedPhotos, face: false }
          }))
        } else if (photoToEdit.type === 'dos') {
          setDetouredDosUrl(processedUrl)
          setFormData(prev => ({
            ...prev,
            existingPhotos: { ...prev.existingPhotos, dos: processedUrl },
            photoDos: null,
            deletedPhotos: { ...prev.deletedPhotos, dos: false }
          }))
        } else if ((photoToEdit.type as any) === 'faceOnModel') {
          setFormData(prev => ({
            ...prev,
            existingPhotos: { ...prev.existingPhotos, faceOnModel: processedUrl },
            deletedPhotos: { ...prev.deletedPhotos, faceOnModel: false }
          }))
        }
      }
      setPhotoToEdit(null)
      setUploadedPhotoUrl(null)
    }

    const handlePhotoEditorCancel = () => {
      setPhotoToEdit(null)
      setUploadedPhotoUrl(null)
    }

    // Analyser produit avec IA (couleur, motif, modèle, description)
    const analyzeProduct = async (imageUrl: string): Promise<{couleur?: string, motif?: string, modele?: string, descriptions?: {fr: string, en: string}} | null> => {
      setGeneratingDesc(true)
      try {
        const response = await fetch('/api/analyze-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            nom: formData.nom,
            marque: formData.marque,
            categorie: formData.categorie,
            matiere: formData.material,
            taille: formData.taille,
            madeIn: formData.madeIn,
          }),
        })
        const data = await response.json()
        if (data.success) {
          return data
        }
        return null
      } catch (err) {
        console.error(err)
        return null
      } finally {
        setGeneratingDesc(false)
      }
    }

    // Accepter suggestion popup
    const handleAcceptSuggestion = async () => {
      if (suggestedDesc) {
        const combined = `${suggestedDesc.fr}\n\n🇬🇧 ${suggestedDesc.en}`
        const newFormData = { ...formData, description: combined }
        setSuggestedDesc(null)
        await onSubmit({ 
          ...newFormData, 
          photoOrder,
          existingPhotos: {
            ...formData.existingPhotos,
            ...(detouredFaceUrl && { face: detouredFaceUrl }),
            ...(detouredDosUrl && { dos: detouredDosUrl }),
          }
        })
      }
    }

    // Refuser suggestion popup
    const handleRejectSuggestion = () => {
      if (suggestedDesc) {
        const combined = `${suggestedDesc.fr}\n\n🇬🇧 ${suggestedDesc.en}`
        setFormData(prev => ({ ...prev, description: combined }))
      }
      setSuggestedDesc(null)
    }

    // =====================
    // EXCEL TEMPLATE GENERATION
    // =====================
    const generateExcelTemplate = async () => {
      const categoriesAutorisees = displayCategories.map(c => c.label)
      
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Nouvelle Rive'
      workbook.created = new Date()
      
      // Couleurs
      const NR_BLUE = '22209C'
      const NR_LIGHT_BLUE = 'E8E8F5'
      const WHITE = 'FFFFFF'
      const GRAY_LIGHT = 'F5F5F5'
      const GRAY_TEXT = '666666'
      const RED = 'DC2626'
      const ORANGE = 'F59E0B'

      // === FEUILLE PRODUITS ===
      const wsProduits = workbook.addWorksheet('Produits', {
        views: [{ showGridLines: false }],
        properties: { defaultColWidth: 15 }
      })
      
      // Définir les colonnes - AJOUT SKU EN PREMIÈRE POSITION
      wsProduits.columns = [
        { key: 'sku', width: 15 },
        { key: 'nom', width: 35 },
        { key: 'categorie', width: 25 },
        { key: 'prix', width: 12 },
        { key: 'quantite', width: 12 },
        { key: 'marque', width: 20 },
        { key: 'taille', width: 12 },
        { key: 'matiere', width: 18 },
        { key: 'couleur', width: 15 },
        { key: 'madein', width: 18 },
        { key: 'description', width: 45 },
      ]
      
      // === HEADER ===
      wsProduits.addRow([])
      wsProduits.addRow(['', '', 'NOUVELLE RIVE'])
      wsProduits.mergeCells('C2:F2')
      const titleCell = wsProduits.getCell('C2')
      titleCell.font = { name: 'Helvetica', size: 24, bold: true, color: { argb: NR_BLUE } }
      titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
      wsProduits.getRow(2).height = 35
      
      const displayName = userName || (isAdmin && selectedChineuse ? selectedChineuse.nom : 'Chineuse')
      wsProduits.addRow(['', '', `Template d'import · ${displayName}`])
      wsProduits.mergeCells('C3:F3')
      const subtitleCell = wsProduits.getCell('C3')
      subtitleCell.font = { name: 'Helvetica', size: 11, italic: true, color: { argb: GRAY_TEXT } }
      subtitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
      
      wsProduits.addRow([])
      wsProduits.addRow(['', '', '⚠️ Les champs avec * sont obligatoires. SKU est optionnel (généré auto si vide).'])
      wsProduits.mergeCells('C5:K5')
      const instructionCell = wsProduits.getCell('C5')
      instructionCell.font = { name: 'Helvetica', size: 10, color: { argb: RED } }
      instructionCell.alignment = { horizontal: 'left', vertical: 'middle' }
      
      wsProduits.addRow([])
      
      const headers = ['SKU', 'Nom *', 'Catégorie *', 'Prix € *', 'Quantité', 'Marque', 'Taille', 'Matière', 'Couleur', 'Made in', 'Description']
      const headerRow = wsProduits.addRow(headers)
      headerRow.height = 28
      
      headerRow.eachCell((cell, colNumber) => {
        const isSkuCol = colNumber === 1
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isSkuCol ? ORANGE : NR_BLUE } }
        cell.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: WHITE } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = {
          top: { style: 'thin', color: { argb: isSkuCol ? ORANGE : NR_BLUE } },
          bottom: { style: 'thin', color: { argb: isSkuCol ? ORANGE : NR_BLUE } },
          left: { style: 'thin', color: { argb: isSkuCol ? ORANGE : NR_BLUE } },
          right: { style: 'thin', color: { argb: isSkuCol ? ORANGE : NR_BLUE } },
        }
      })
      
      const DATA_START_ROW = 8
      const DATA_END_ROW = 57
      
      for (let i = 0; i < 50; i++) {
        const dataRow = wsProduits.addRow(['', '', '', '', 1, '', '', '', '', '', ''])
        dataRow.height = 24
        
        dataRow.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: i % 2 === 0 ? WHITE : GRAY_LIGHT }
          }
          cell.font = { name: 'Helvetica', size: 10, color: { argb: '333333' } }
          cell.alignment = { horizontal: 'left', vertical: 'middle' }
          cell.border = {
            bottom: { style: 'hair', color: { argb: 'DDDDDD' } },
          }
          
          if (colNumber === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: i % 2 === 0 ? 'FEF3C7' : 'FDE68A' }
            }
          }
          else if (colNumber >= 2 && colNumber <= 4) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: i % 2 === 0 ? NR_LIGHT_BLUE : 'F0F0FA' }
            }
          }
        })
      }
      
      if (categoriesAutorisees.length > 0) {
        for (let row = DATA_START_ROW; row <= DATA_END_ROW; row++) {
          wsProduits.getCell(`C${row}`).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [`Listes!$A$2:$A$${categoriesAutorisees.length + 1}`],
            showErrorMessage: true,
            errorTitle: 'Catégorie invalide',
            error: 'Veuillez choisir une catégorie dans la liste.',
            showInputMessage: true,
            promptTitle: 'Catégorie',
            prompt: 'Sélectionnez une catégorie dans la liste'
          }
        }
      }
      
      for (let row = DATA_START_ROW; row <= DATA_END_ROW; row++) {
        wsProduits.getCell(`G${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Listes!$B$2:$B$${ALL_TAILLES.length + 1}`],
          showErrorMessage: true,
          errorTitle: 'Taille invalide',
          error: 'Veuillez choisir une taille dans la liste ou laisser vide.',
        }
      }
      
      for (let row = DATA_START_ROW; row <= DATA_END_ROW; row++) {
        wsProduits.getCell(`J${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Listes!$C$2:$C$${MADE_IN_OPTIONS.length + 1}`],
        }
      }

      // Validation matières (colonne H)
      for (let row = DATA_START_ROW; row <= DATA_END_ROW; row++) {
        wsProduits.getCell(`H${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Listes!$D$2:$D$${ALL_MATIERES.length + 1}`],
        }
      }
      
      for (let row = DATA_START_ROW; row <= DATA_END_ROW; row++) {
        wsProduits.getCell(`D${row}`).dataValidation = {
          type: 'decimal',
          operator: 'greaterThan',
          formulae: [0],
          allowBlank: false,
          showErrorMessage: true,
          errorTitle: 'Prix invalide',
          error: 'Le prix doit être un nombre positif.',
        }
        wsProduits.getCell(`D${row}`).numFmt = '#,##0.00 €'
      }
      
      for (let row = DATA_START_ROW; row <= DATA_END_ROW; row++) {
        wsProduits.getCell(`E${row}`).dataValidation = {
          type: 'whole',
          operator: 'greaterThanOrEqual',
          formulae: [1],
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: 'Quantité invalide',
          error: 'La quantité doit être un nombre entier >= 1.',
        }
      }
      
      const wsListes = workbook.addWorksheet('Listes', { state: 'veryHidden' })
      
      wsListes.getCell('A1').value = 'Catégories'
      categoriesAutorisees.forEach((cat, i) => {
        wsListes.getCell(`A${i + 2}`).value = cat
      })
      
      wsListes.getCell('B1').value = 'Tailles'
      ALL_TAILLES.forEach((taille, i) => {
        wsListes.getCell(`B${i + 2}`).value = taille
      })
      
      wsListes.getCell('C1').value = 'Made in'
      MADE_IN_OPTIONS.forEach((opt, i) => {
        wsListes.getCell(`C${i + 2}`).value = opt
      })

      // Matières
      wsListes.getCell('D1').value = 'Matières'
      ALL_MATIERES.forEach((mat, i) => {
        wsListes.getCell(`D${i + 2}`).value = mat
      })
      
      const wsAide = workbook.addWorksheet('Aide', { 
        views: [{ showGridLines: false }],
        properties: { tabColor: { argb: NR_BLUE } }
      })
      
      wsAide.columns = [{ width: 5 }, { width: 20 }, { width: 60 }]
      
      wsAide.addRow([])
      wsAide.addRow(['', 'GUIDE D\'IMPORT'])
      wsAide.mergeCells('B2:C2')
      wsAide.getCell('B2').font = { name: 'Helvetica', size: 18, bold: true, color: { argb: NR_BLUE } }
      
      wsAide.addRow([])
      
      const aideData = [
        ['Champ', 'Description'],
        ['SKU', 'Référence unique (optionnel). Si vide, sera généré automatiquement. Ex: PV31, ABC123'],
        ['Nom *', 'Nom de l\'article (obligatoire).'],
        ['Catégorie *', 'Choisir dans la liste déroulante (obligatoire).'],
        ['Prix € *', 'Prix de vente en euros (obligatoire). Ex: 45 ou 129.90'],
        ['Quantité', 'Nombre d\'exemplaires. Par défaut: 1'],
        ['Marque', 'Marque ou griffe du vêtement. Ex: Chanel, Sézane...'],
        ['Taille', 'Choisir dans la liste. Dépend de la catégorie (vêtements, chaussures, bagues).'],
        ['Matière', 'Composition principale. Ex: Cuir, Soie, Coton, Laine...'],
        ['Couleur', 'Couleur principale. Ex: Noir, Bleu marine, Écru...'],
        ['Made in', 'Pays de fabrication si connu.'],
        ['Description', 'État, époque, détails particuliers, défauts éventuels...'],
      ]
      
      aideData.forEach((row, i) => {
        const r = wsAide.addRow(['', ...row])
        if (i === 0) {
          r.eachCell((cell, col) => {
            if (col > 1) {
              cell.font = { name: 'Helvetica', size: 11, bold: true, color: { argb: WHITE } }
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NR_BLUE } }
            }
          })
        } else if (i === 1) {
          r.getCell(2).font = { name: 'Helvetica', size: 10, bold: true, color: { argb: ORANGE } }
          r.getCell(3).font = { name: 'Helvetica', size: 10 }
        } else {
          r.getCell(2).font = { name: 'Helvetica', size: 10, bold: true }
          r.getCell(3).font = { name: 'Helvetica', size: 10 }
        }
      })
      
      wsAide.addRow([])
      wsAide.addRow(['', '📌 Vos catégories autorisées:'])
      wsAide.getCell(`B${wsAide.rowCount}`).font = { name: 'Helvetica', size: 11, bold: true, color: { argb: NR_BLUE } }
      
      categoriesAutorisees.forEach(cat => {
        const r = wsAide.addRow(['', `  • ${cat}`])
        r.getCell(2).font = { name: 'Helvetica', size: 10 }
      })
      
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      
      const safeName = (userName || 'Chineuse').replace(/[^a-zA-Z0-9]/g, '_')
      const link = document.createElement('a')
      link.href = url
      link.download = `Import_NouvelleRive_${safeName}.xlsx`
      link.click()
      
      URL.revokeObjectURL(url)
    }

    // =====================
    // EXCEL IMPORT
    // =====================
    const handleExcelImport = async () => {
      if (!excelFile || !onExcelImport) return
      
      setImportLoading(true)
      
      try {
        const reader = new FileReader()
        
        reader.onload = async (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer)
            const workbook = XLSX.read(data, { type: 'array' })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 })
            
            let headersIndex = -1
            let mapping: Record<string, number> = {}
            
            for (let i = 0; i < Math.min(raw.length, 15); i++) {
              const line = raw[i] as string[]
              if (!line) continue
              
              const map: Record<string, number> = {}
              line.forEach((cell, index) => {
                if (!cell) return
                const key = getAliasKey(String(cell).replace(/\s*\*\s*/g, ''))
                if (key) map[key] = index
              })
              
              if (map.nom !== undefined && map.categorie !== undefined && map.prix !== undefined) {
                headersIndex = i
                mapping = map
                break
              }
            }
            
            if (headersIndex === -1) {
              alert("❌ Colonnes obligatoires non trouvées : 'Nom', 'Catégorie', 'Prix'\n\nUtilisez le template fourni.")
              setImportLoading(false)
              return
            }
            
            const rows = (raw as any[]).slice(headersIndex + 1)
            const categoriesAutorisees = displayCategories.map(c => c.label.toLowerCase().trim())
            
            const produits: ExcelImportData[] = []
            const erreurs: string[] = []
            
            for (let idx = 0; idx < rows.length; idx++) {
              const row = rows[idx] as any[]
              if (!row) continue
              
              const rec: Record<string, any> = {}
              for (const key in mapping) {
                rec[key] = row[mapping[key]]
              }
              
              if (!rec.nom && !rec.categorie && !rec.prix) continue
              
              const rowNum = idx + headersIndex + 2
              
              if (!rec.nom || !String(rec.nom).trim()) {
                erreurs.push(`Ligne ${rowNum}: Nom manquant`)
                continue
              }
              if (!rec.categorie || !String(rec.categorie).trim()) {
                erreurs.push(`Ligne ${rowNum}: Catégorie manquante`)
                continue
              }
              if (!rec.prix) {
                erreurs.push(`Ligne ${rowNum}: Prix manquant`)
                continue
              }
              
              const nom = String(rec.nom).trim()
              const categorie = String(rec.categorie).trim()
              const prix = parseFloat(String(rec.prix).toString().replace(',', '.').replace(/[^\d.]/g, ''))
              
              if (!categoriesAutorisees.includes(categorie.toLowerCase().trim())) {
                erreurs.push(`Ligne ${rowNum}: Catégorie "${categorie}" non autorisée`)
                continue
              }
              
              const catMatch = displayCategories.find(c => c.label.toLowerCase().trim() === categorie.toLowerCase().trim())
              if (!catMatch?.idsquare) {
                erreurs.push(`Ligne ${rowNum}: Catégorie "${categorie}" non configurée dans Square`)
                continue
              }
              
              if (isNaN(prix) || prix <= 0) {
                erreurs.push(`Ligne ${rowNum}: Prix invalide`)
                continue
              }
              
              let skuValue: string | undefined = undefined
              if (rec.sku !== undefined && rec.sku !== null && rec.sku !== '') {
                const skuRaw = rec.sku
                if (typeof skuRaw === 'number') {
                  skuValue = String(skuRaw)
                } else {
                  skuValue = String(skuRaw).trim()
                }
                if (!skuValue) skuValue = undefined
              }
              
              produits.push({
                nom,
                categorie,
                prix,
                quantite: parseInt(String(rec.quantite)) || 1,
                marque: rec.marque ? String(rec.marque).trim() : '',
                taille: rec.taille ? String(rec.taille).trim() : '',
                material: rec.material ? String(rec.material).trim() : '',
                color: rec.color ? String(rec.color).trim() : '',
                description: rec.description ? String(rec.description).trim() : '',
                madeIn: rec.madeIn ? String(rec.madeIn).trim() : '',
                sku: skuValue,
              })
            }
            
            if (erreurs.length > 0) {
              const showMax = 5
              alert(`⚠️ ${erreurs.length} erreur(s) :\n\n${erreurs.slice(0, showMax).join('\n')}${erreurs.length > showMax ? `\n... et ${erreurs.length - showMax} autre(s)` : ''}`)
              if (produits.length === 0) {
                setImportLoading(false)
                return
              }
            }
            
            if (produits.length === 0) {
              alert('❌ Aucun produit valide à importer.')
              setImportLoading(false)
              return
            }
            
            // ✅ VÉRIFICATION UNICITÉ DES SKU FOURNIS
            const skusToCheck = produits.filter(p => p.sku).map(p => p.sku!)
            const skuDoublons: string[] = []

            for (const skuToCheck of skusToCheck) {
              const isUnique = await checkSkuUnique(skuToCheck)
              if (!isUnique) {
                skuDoublons.push(skuToCheck)
              }
            }

            // Filtrer les produits avec SKU doublon
            const produitsValides = produits.filter(p => !p.sku || !skuDoublons.includes(p.sku))

            if (skuDoublons.length > 0) {
              const msg = `⚠️ ${skuDoublons.length} SKU déjà existant(s) :\n${skuDoublons.join(', ')}\n\nCes lignes seront ignorées.`
              alert(msg)
            }

            if (produitsValides.length === 0) {
              alert('❌ Aucun produit valide à importer (tous les SKU existent déjà).')
              setImportLoading(false)
              return
            }
            
            const withSku = produitsValides.filter(p => p.sku).length
            const withoutSku = produitsValides.length - withSku
            let confirmMsg = `📦 ${produitsValides.length} produit(s) à importer.`
            if (withSku > 0) confirmMsg += `\n\n• ${withSku} avec SKU personnalisé`
            if (withoutSku > 0) confirmMsg += `\n• ${withoutSku} avec SKU auto-généré`
            confirmMsg += '\n\nContinuer ?'
            
            if (!confirm(confirmMsg)) {
              setImportLoading(false)
              return
            }
            
            await onExcelImport(produitsValides)
            
            setExcelFile(null)
            setShowExcelSection(false)
            
          } catch (err: any) {
            alert('❌ Erreur de lecture : ' + (err?.message || 'Format invalide'))
          } finally {
            setImportLoading(false)
          }
        }
        
        reader.readAsArrayBuffer(excelFile)
        
      } catch (err: any) {
        alert('❌ Erreur : ' + (err?.message || ''))
        setImportLoading(false)
      }
    }

    // =====================
    // GESTION PHOTOS
    // =====================
    const handleDeleteExistingPhoto = (type: 'face' | 'faceOnModel' | 'dos' | 'detail', index?: number) => {
      setFormData(prev => {
        const newDeletedPhotos = { ...prev.deletedPhotos }
        const newExistingPhotos = { ...prev.existingPhotos }
        
        if (type === 'detail' && typeof index === 'number') {
          const detailsIndexes = [...(newDeletedPhotos.detailsIndexes || [])]
          if (!detailsIndexes.includes(index)) detailsIndexes.push(index)
          newDeletedPhotos.detailsIndexes = detailsIndexes
        } else if (type === 'face') {
          newDeletedPhotos.face = true
          delete newExistingPhotos.face
        } else if (type === 'faceOnModel') {
          newDeletedPhotos.faceOnModel = true
          delete newExistingPhotos.faceOnModel
        } else if (type === 'dos') {
          newDeletedPhotos.dos = true
          delete newExistingPhotos.dos
        }
        
        return { ...prev, deletedPhotos: newDeletedPhotos, existingPhotos: newExistingPhotos }
      })
    }

    const isDetailDeleted = (index: number) => formData.deletedPhotos.detailsIndexes?.includes(index) || false
    const existingDetails = (formData.existingPhotos.details || []).filter((_, i) => !isDetailDeleted(i))

    const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      
      // En mode création, vérifier que la catégorie a un idsquare
      if (mode === 'create') {
        const match = displayCategories.find((c) => c?.label === formData.categorie)
        if (!match?.idsquare) {
          alert('❌ Catégorie non définie dans Square.\n\nContactez NOUVELLE RIVE pour configurer cette catégorie.')
          return
        }
      }
      
      // ✅ VÉRIFICATION UNICITÉ SKU
      const finalSku = formData.sku || sku
      if (finalSku) {
        setSkuValidating(true)
        const isUnique = await checkSkuUnique(finalSku, productId)
        setSkuValidating(false)
        if (!isUnique) {
          alert(`❌ Le SKU "${finalSku}" est déjà utilisé par un autre produit.`)
          return
        }
      }
      
      // Si description vide → générer avec IA + popup
      if (!formData.description.trim() && formData.nom) {
        const imageUrl = formData.existingPhotos.face || detouredFaceUrl
        if (imageUrl) {
          const result = await analyzeProduct(imageUrl)
          if (result?.descriptions) {
            if (result.couleur && !formData.color) setFormData(prev => ({ ...prev, color: result.couleur! }))
            setSuggestedDesc(result.descriptions)
            return // Attendre validation du popup
          }
        }
      }
      
      await onSubmit({ 
        ...formData, 
        photoOrder,
        existingPhotos: {
          ...formData.existingPhotos,
          ...(detouredFaceUrl && { face: detouredFaceUrl }),
          ...(detouredDosUrl && { dos: detouredDosUrl }),
        }
      })
    }

    const defaultSubmitLabel = mode === 'create' ? '✓ Ajouter le produit' : '✓ Enregistrer'

    // =====================
    // RENDER
    // =====================
    return (
      <div className="space-y-4">
        
        {/* === GUIDE PHOTO === */}
        <PhotoGuideModal />
        
        {/* === IMPORT EXCEL (mode création uniquement) === */}
        {mode === 'create' && showExcelImport && onExcelImport && (
          <div className="bg-white border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowExcelSection(!showExcelSection)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-2 text-[#22209C]">
                <FileSpreadsheet size={18} />
                <span className="font-medium text-sm">Import Excel</span>
              </div>
              <span className="text-gray-400 text-sm">{showExcelSection ? '✕' : '+'}</span>
            </button>
            
            {showExcelSection && (
              <div className="px-4 pb-4 border-t bg-gray-50">
                <p className="text-xs text-gray-500 py-3">
                  Importez plusieurs produits d'un coup via un fichier Excel.
                </p>
                
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={generateExcelTemplate}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-[#22209C] text-[#22209C] rounded text-sm hover:bg-[#22209C] hover:text-white transition w-fit"
                  >
                    <Download size={16} />
                    Télécharger le template
                  </button>
                  
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.add('border-[#22209C]', 'bg-blue-50')
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-[#22209C]', 'bg-blue-50')
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-[#22209C]', 'bg-blue-50')
                      const file = e.dataTransfer.files[0]
                      if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                        setExcelFile(file)
                      } else {
                        alert('Veuillez déposer un fichier Excel (.xlsx ou .xls)')
                      }
                    }}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors"
                  >
                    {excelFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileSpreadsheet size={24} className="text-green-600" />
                        <span className="text-green-600 font-medium">{excelFile.name}</span>
                        <button
                          type="button"
                          onClick={() => setExcelFile(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload size={32} className="mx-auto text-gray-400" />
                        <p className="text-gray-600">Glissez-déposez votre fichier Excel ici</p>
                        <p className="text-gray-400 text-sm">ou</p>
                        <label className="inline-block px-4 py-2 bg-[#22209C] text-white rounded cursor-pointer hover:opacity-90 transition">
                          Parcourir...
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) setExcelFile(file)
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleExcelImport}
                    disabled={!excelFile || importLoading}
                    className="w-full py-3 bg-[#22209C] text-white rounded font-medium disabled:opacity-40 hover:opacity-90 transition"
                  >
                    {importLoading ? '⏳ Import en cours...' : `📥 Importer ${excelFile ? excelFile.name : ''}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === FORMULAIRE === */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          
          {/* SÉLECTION CHINEUSE (Admin only) */}
          {isAdmin && chineuses.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-purple-700 mb-2">
                Créer en tant que
              </label>
              <select
                value={selectedChineuse?.uid || ''}
                onChange={(e) => {
                  const chineuse = chineuses.find(c => c.uid === e.target.value) || null
                  onChineuseChange?.(chineuse)
                  setFormData(prev => ({ ...prev, categorie: '', taille: '' }))
                }}
                required
                className="w-full border rounded px-3 py-2 bg-white"
              >
                <option value="">Sélectionner une chineuse</option>
                {chineuses.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.nom} ({c.trigramme})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* CHAMPS OBLIGATOIRES */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Obligatoire</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              
              {/* Nom de la pièce */}
              <div className="col-span-3">
                <label className="block text-sm font-medium mb-1">Nom de la pièce *</label>
                <div className="flex">
                  {mode === 'create' && sku && (
                    <span className="px-3 py-1.5 bg-gray-100 border border-r-0 rounded-l text-sm text-gray-600">
                      {sku} -
                    </span>
                  )}
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    required
                    className={`w-full border rounded px-2 py-1.5 text-sm ${mode === 'create' && sku ? 'rounded-l-none' : ''}`}
                    placeholder="Nom du produit"
                  />
                </div>
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  SKU {isAdmin && <span className="text-orange-500 text-xs">(modifiable)</span>}
                </label>
                {isAdmin ? (
                  <input
                    type="text"
                    value={formData.sku || sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    className="w-full border border-orange-300 rounded px-2 py-1.5 text-sm bg-orange-50"
                    placeholder={sku || 'SKU'}
                  />
                ) : (
                  <input
                    type="text"
                    value={sku || '—'}
                    readOnly
                    className="w-full border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-600"
                  />
                )}
                {nextAvailableSku && (
                  <p className="text-xs text-green-600 mt-1">Prochain SKU suggéré : <strong>{nextAvailableSku}</strong></p>
                )}
                </div>

              {/* Catégorie */}
              <div>
                <label className="block text-sm font-medium mb-1">Catégorie</label>
                <select
                  value={formData.categorie}
                  onChange={(e) => setFormData({ ...formData, categorie: e.target.value, taille: '' })}
                  required
                  disabled={isAdmin && chineuses.length > 0 && !selectedChineuse}
                  className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100"
                >
                  <option value="">Choisir...</option>
                  {displayCategories.map((cat, i) => (
                    <option key={i} value={cat.label}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Taille */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {typeTaille === 'chaussures' ? 'Pointure' : 'Taille'}
                </label>
                {taillesDisponibles.length > 0 ? (
                  <select
                    value={formData.taille}
                    onChange={(e) => setFormData({ ...formData, taille: e.target.value })}
                    required
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">Choisir...</option>
                    {taillesDisponibles.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value="N/A"
                    disabled
                    className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100 text-gray-500"
                  />
                )}
              </div>

              {/* Prix */}
              <div>
                <label className="block text-sm font-medium mb-1">Prix (€)</label>
                <input
                  type="number"
                  value={formData.prix}
                  onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
                  step="0.01"
                  min="0"
                  required
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="45"
                />
              </div>

              {/* Quantité */}
              <div>
                <label className="block text-sm font-medium mb-1">Quantité</label>
                <input
                  type="number"
                  value={formData.quantite}
                  onChange={(e) => setFormData({ ...formData, quantite: e.target.value })}
                  min="1"
                  required
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* CHAMPS OPTIONNELS */}
          <div className="bg-gray-50 border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Optionnel</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Marque</label>
                <input
                  type="text"
                  value={formData.marque}
                  onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="Chanel..."
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Matière</label>
                <div className="flex flex-wrap gap-1.5">
                  {matieresDisponibles.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const current = formData.material ? formData.material.split(', ').filter(Boolean) : []
                        const updated = current.includes(m) ? current.filter(x => x !== m) : [...current, m]
                        setFormData({ ...formData, material: updated.join(', ') })
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        formData.material.split(', ').includes(m)
                          ? 'bg-[#22209C] text-white border-[#22209C]'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2 md:col-span-4">
                <label className="block text-xs text-gray-600 mb-1">Couleur</label>
                <div className="grid grid-cols-7 md:grid-cols-11 gap-1.5 overflow-hidden pb-1">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        const current = formData.color ? formData.color.split(', ').filter(Boolean) : []
                        const updated = current.includes(c.name) ? current.filter(x => x !== c.name) : [...current, c.name]
                        setFormData({ ...formData, color: updated.join(', ') })
                      }}
                      className={`group relative w-7 h-7 rounded-full border-2 transition-all ${
                        formData.color.split(', ').includes(c.name) 
                          ? 'border-[#22209C] scale-110 ring-2 ring-[#22209C]/30' 
                          : 'border-gray-200 hover:border-gray-400 hover:scale-105'
                      }`}
                      style={{ 
                        background: c.hex.startsWith('linear') ? c.hex : c.hex,
                        boxShadow: c.name === 'Blanc' ? 'inset 0 0 0 1px #ddd' : undefined
                      }}
                    >
                      {formData.color.split(', ').includes(c.name) && (
                        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${
                          ['Noir', 'Bleu marine', 'Marron', 'Anthracite', 'Bordeaux', 'Vert', 'Kaki', 'Violet'].includes(c.name) 
                            ? 'text-white' 
                            : 'text-gray-800'
                        }`}>
                          ✓
                        </span>
                      )}
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
                {formData.color && (
                  <p className="text-xs text-[#22209C] mt-1.5 font-medium">{formData.color}</p>
                )}
              </div>

              <div className="col-span-2 md:col-span-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-600">Description</label>
                 <button
                    type="button"
                    onClick={async () => {
                      const imageUrl = formData.existingPhotos.face || detouredFaceUrl
                      if (!imageUrl) {
                        alert('Ajoutez une photo face d\'abord')
                        return
                      }
                      const result = await analyzeProduct(imageUrl)
                      if (result) {
                        if (result.couleur) setFormData(prev => ({ ...prev, color: result.couleur! }))
                        if (result.descriptions) {
                          const combined = `${result.descriptions.fr}\n\n🇬🇧 ${result.descriptions.en}`
                          setFormData(prev => ({ ...prev, description: combined }))
                        }
                      } else {
                        alert('Erreur lors de l\'analyse')
                      }
                    }}
                    disabled={generatingDesc || !formData.nom}
                    className="text-xs text-[#22209C] hover:underline disabled:opacity-40 disabled:no-underline flex items-center gap-1"
                  >
                    {generatingDesc ? '⏳ Rédaction...' : '✍️ Rédiger'}
                  </button>
                </div>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm resize-none"
                  rows={4}
                  placeholder="État, époque, détails... ou cliquez sur 'Rédiger'"
                />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t">
              <label className="block text-xs text-gray-600 mb-2">Made in</label>
              <div className="flex flex-wrap gap-4">
                {[
                  { value: '', label: 'Non spécifié' },
                  { value: 'Made in France', label: '🇫🇷 France' },
                  { value: 'Made in Italy', label: '🇮🇹 Italy' },
                  { value: 'Made in USA', label: '🇺🇸 USA' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="madeIn"
                      value={opt.value}
                      checked={formData.madeIn === opt.value}
                      onChange={(e) => setFormData({ ...formData, madeIn: e.target.value })}
                      className="accent-[#22209C]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* PHOTOS */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">📸 Photos</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Photo Face */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-blue-700">Face</label>
                
                {formData.existingPhotos.face && !formData.deletedPhotos.face && (
                  <div className="relative group">
                    <img src={formData.existingPhotos.face} alt="Face" className="w-full h-32 object-cover rounded border" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => {
                          setUploadedPhotoUrl(formData.existingPhotos.face!)
                          setPhotoToEdit({ file: new File([], 'existing'), type: 'face', alreadyProcessed: true })
                        }}
                        className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600"
                        title="Modifier"
                      >
                        <ImageIcon size={16} />
                      </button>
                      <button type="button" onClick={() => setDeletePhotoConfirm({ type: 'face' })} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                        <X size={16} />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">✓</span>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraFaceRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleCameraCapture('face', file)
                      e.target.value = ''
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => cameraFaceRef.current?.click()}
                    className="w-16 h-16 bg-blue-50 border-2 border-dashed border-blue-300 rounded flex items-center justify-center text-blue-600 hover:bg-blue-100 transition"
                    title="Prendre une photo"
                  >
                    <Camera size={20} />
                  </button>
                  
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.add('border-blue-500', 'bg-blue-100')
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')
                      const file = e.dataTransfer.files[0]
                      if (file && file.type.startsWith('image/')) {
                        handleCameraCapture('face', file)
                      } else {
                        alert('Veuillez déposer une image')
                      }
                    }}
                    className={`flex-1 border-2 border-dashed rounded p-2 text-center transition-colors ${formData.existingPhotos.face && !formData.deletedPhotos.face ? 'border-gray-200' : 'border-blue-300 bg-blue-50'}`}
                  >
                    {formData.photoFace ? (
                      <div className="flex items-center justify-center gap-2 text-green-600 h-12">
                        <RefreshCw size={16} />
                        <span className="text-xs truncate max-w-[80px]">{formData.photoFace.name}</span>
                        <button type="button" onClick={() => setFormData({ ...formData, photoFace: null })} className="text-red-500 hover:text-red-700">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block h-12 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Upload size={16} />
                          <span className="text-xs">{formData.existingPhotos.face ? 'Remplacer' : 'Fichier'}</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleCameraCapture('face', file)
                            e.target.value = ''
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Photo Dos */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">Dos</label>
                
                {formData.existingPhotos.dos && !formData.deletedPhotos.dos && (
                  <div className="relative group">
                    <img src={formData.existingPhotos.dos} alt="Dos" className="w-full h-32 object-cover rounded border" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => {
                          setUploadedPhotoUrl(formData.existingPhotos.dos!)
                          setPhotoToEdit({ file: new File([], 'existing'), type: 'dos', alreadyProcessed: true })
                        }}
                        className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600"
                        title="Modifier"
                      >
                        <ImageIcon size={16} />
                      </button>
                      <button type="button" onClick={() => setDeletePhotoConfirm({ type: 'dos' })} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                        <X size={16} />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">✓</span>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraDosRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleCameraCapture('dos', file)
                      e.target.value = ''
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => cameraDosRef.current?.click()}
                    className="w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 transition"
                    title="Prendre une photo"
                  >
                    <Camera size={20} />
                  </button>
                  
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.add('border-blue-500', 'bg-blue-100')
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')
                      const file = e.dataTransfer.files[0]
                      if (file && file.type.startsWith('image/')) {
                        handleCameraCapture('dos', file)
                      } else {
                        alert('Veuillez déposer une image')
                      }
                    }}
                    className="flex-1 border-2 border-dashed border-gray-200 rounded p-2 text-center transition-colors"
                  >
                    {formData.photoDos ? (
                      <div className="flex items-center justify-center gap-2 text-green-600 h-12">
                        <RefreshCw size={16} />
                        <span className="text-xs truncate max-w-[80px]">{formData.photoDos.name}</span>
                        <button type="button" onClick={() => setFormData({ ...formData, photoDos: null })} className="text-red-500 hover:text-red-700">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block h-12 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Upload size={16} />
                          <span className="text-xs">{formData.existingPhotos.dos ? 'Remplacer' : 'Fichier'}</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleCameraCapture('dos', file)
                            e.target.value = ''
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Photos Détails */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">Détails</label>
                
                {existingDetails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(formData.existingPhotos.details || []).map((url, i) => (
                      !isDetailDeleted(i) && (
                        <div key={i} className="relative group w-14 h-14">
                          <img src={url} alt={`Détail ${i + 1}`} className="w-full h-full object-cover rounded border" />
                          <button type="button" onClick={() => setDeletePhotoConfirm({ type: 'detail', index: i })} className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={12} />
                          </button>
                        </div>
                      )
                    ))}
                  </div>
                )}
                
                {formData.photosDetails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.photosDetails.map((file, i) => (
                      <div key={i} className="relative group w-14 h-14">
                        <img src={URL.createObjectURL(file)} alt={`Nouveau ${i + 1}`} className="w-full h-full object-cover rounded border" />
                        <button 
                          type="button" 
                          onClick={() => setFormData(prev => ({ 
                            ...prev, 
                            photosDetails: prev.photosDetails.filter((_, idx) => idx !== i) 
                          }))} 
                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraDetailsRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleCameraCapture('details', file)
                      e.target.value = ''
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => cameraDetailsRef.current?.click()}
                    className="w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 transition"
                    title="Prendre une photo"
                  >
                    <Camera size={20} />
                  </button>
                  
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.add('border-blue-500', 'bg-blue-100')
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')
                    }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')
                      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
                      if (files.length > 0) {
                        for (const file of files) {
                          await handleCameraCapture('details', file)
                        }
                      } else {
                        alert('Veuillez déposer des images')
                      }
                    }}
                    className="flex-1 border-2 border-dashed border-gray-200 rounded p-2 text-center transition-colors"
                  >
                    <label className="cursor-pointer block h-12 flex items-center justify-center">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Upload size={16} />
                        <span className="text-xs">Fichiers</span>
                      </div>
                    <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || [])
                            for (const file of files) {
                              await handleCameraCapture('details', file)
                            }
                            e.target.value = ''
                          }}
                          className="hidden"
                        />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {formData.existingPhotos.faceOnModel && !formData.deletedPhotos.faceOnModel && (
              <div className="mt-4 pt-4 border-t">
                <label className="block text-xs font-medium text-purple-600 mb-2">📷 Photo portée (générée automatiquement)</label>
                <div className="relative group w-32 h-32">
                  <img src={formData.existingPhotos.faceOnModel} alt="Photo portée" className="w-full h-full object-cover rounded border" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
                    <button 
                      type="button" 
                      onClick={() => {
                        setUploadedPhotoUrl(formData.existingPhotos.faceOnModel!)
                        setPhotoToEdit({ file: new File([], 'existing'), type: 'faceOnModel' as any, alreadyProcessed: true } as any)
                      }}
                      className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600"
                      title="Modifier"
                    >
                      <ImageIcon size={14} />
                    </button>
                    <button type="button" onClick={() => setDeletePhotoConfirm({ type: 'faceOnModel' })} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Section réordonnancement */}
            <PhotoReorderSection
              photos={photoOrder}
              onReorder={setPhotoOrder}
            />
          </div>

        {/* BOUTONS */}
          <div className="flex gap-3">
            {onCancel && (
              <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition">
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={loading || skuValidating || (isAdmin && chineuses.length > 0 && !selectedChineuse)}
              className={`${onCancel ? 'flex-1' : 'w-full'} bg-[#22209C] text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition`}
            >
              {loading || skuValidating ? '⏳ En cours...' : (submitLabel || defaultSubmitLabel)}
            </button>
          </div>
        </form>

        {/* Loader pendant upload photo */}
        {uploadingPhoto && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
              <p className="text-gray-700 font-medium">Chargement de l'image...</p>
            </div>
          </div>
        )}

        {/* Popup suggestion description */}
        {suggestedDesc && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
              <h2 className="text-lg font-bold text-[#22209C] mb-4">✍️ Description suggérée</h2>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">🇫🇷 Français</p>
                  <p className="text-sm text-gray-800">{suggestedDesc.fr}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">🇬🇧 English</p>
                  <p className="text-sm text-gray-600 italic">{suggestedDesc.en}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRejectSuggestion}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  ✏️ Modifier
                </button>
                <button
                  type="button"
                  onClick={handleAcceptSuggestion}
                  disabled={loading}
                  className="flex-1 bg-[#22209C] text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition"
                >
                  {loading ? '⏳...' : '✓ Valider et créer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal confirmation suppression photo */}
        {deletePhotoConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Supprimer cette photo ?</h2>
              <p className="text-sm text-gray-500 mb-6">Cette action est irréversible.</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeletePhotoConfirm(null)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteExistingPhoto(deletePhotoConfirm.type, deletePhotoConfirm.index)
                    setDeletePhotoConfirm(null)
                  }}
                  className="flex-1 bg-red-500 text-white py-2.5 rounded-lg font-semibold hover:bg-red-600 transition"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Photo Editor Modal */}
        {photoToEdit && uploadedPhotoUrl && (
          <PhotoEditor
            imageUrl={uploadedPhotoUrl}
            onConfirm={handlePhotoEditorConfirm}
            onCancel={handlePhotoEditorCancel}
            alreadyProcessed={(photoToEdit as any).alreadyProcessed}
          />
        )}
      </div>
    )
  }

  // Export types
  export type { ProductFormData, Cat, Chineuse, ExistingPhotos, ExcelImportData, PhotoItem }