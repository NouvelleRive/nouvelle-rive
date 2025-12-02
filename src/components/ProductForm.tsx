// components/ProductForm.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Image as ImageIcon, Upload, RefreshCw, FileSpreadsheet, Download, Camera } from 'lucide-react'
import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'

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
const TAILLES = {
  adulte: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'],
  enfant: ['0-3M', '3-6M', '6-12M', '12-18M', '18-24M', '2A', '3A', '4A', '5A', '6A', '8A', '10A', '12A', '14A', '16A'],
  chaussures: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  bague: ['48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '62', '64', '66'],
  aucune: [],
}

const MADE_IN_OPTIONS = ['', 'Made in France', 'Made in Italy', 'Made in USA', 'Made in UK', 'Made in Spain', 'Made in Germany', 'Made in Japan']

type TypeTaille = keyof typeof TAILLES

function detectTypeTaille(categorie: string): TypeTaille {
  const cat = (categorie || '').toLowerCase()
  
  if (cat.includes('bague')) return 'bague'
  
  if (
    cat.includes('broche') || cat.includes('collier') || 
    cat.includes('bracelet') || cat.includes('boucle') || cat.includes('bijou') ||
    cat.includes('sac') || cat.includes('ceinture') || cat.includes('foulard') ||
    cat.includes('écharpe') || cat.includes('lunettes') || cat.includes('chapeau') ||
    cat.includes('bonnet') || cat.includes('gant') || cat.includes('montre') ||
    cat.includes('porte') || cat.includes('accessoire')
  ) {
    return 'aucune'
  }
  
  if (
    cat.includes('chaussure') || cat.includes('basket') || cat.includes('botte') ||
    cat.includes('bottine') || cat.includes('sandale') || cat.includes('escarpin') || 
    cat.includes('mocassin') || cat.includes('derby') || cat.includes('loafer') ||
    cat.includes('sneaker') || cat.includes('talon')
  ) {
    return 'chaussures'
  }
  
  if (
    cat.includes('enfant') || cat.includes('bébé') || cat.includes('bebe') ||
    cat.includes('kid') || cat.includes('baby')
  ) {
    return 'enfant'
  }
  
  return 'adulte'
}

// Toutes les tailles possibles pour le template Excel
const ALL_TAILLES = [...new Set([...TAILLES.adulte, ...TAILLES.enfant, ...TAILLES.chaussures, ...TAILLES.bague])]

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

  const typeTaille = detectTypeTaille(formData.categorie)
  const taillesDisponibles = TAILLES[typeTaille]

  // Catégories à afficher
  const displayCategories = isAdmin && selectedChineuse 
    ? selectedChineuse.categories 
    : categories

  // =====================
  // CAMERA HANDLERS
  // =====================
  const handleCameraCapture = (type: 'face' | 'dos' | 'details', file: File) => {
    if (type === 'face') {
      setFormData(prev => ({ ...prev, photoFace: file }))
    } else if (type === 'dos') {
      setFormData(prev => ({ ...prev, photoDos: file }))
    } else if (type === 'details') {
      setFormData(prev => ({ ...prev, photosDetails: [...prev.photosDetails, file] }))
    }
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
      { key: 'sku', width: 15 },        // A - SKU (optionnel)
      { key: 'nom', width: 35 },        // B - Nom
      { key: 'categorie', width: 25 },  // C - Catégorie
      { key: 'prix', width: 12 },       // D - Prix
      { key: 'quantite', width: 12 },   // E - Quantité
      { key: 'marque', width: 20 },     // F - Marque
      { key: 'taille', width: 12 },     // G - Taille
      { key: 'matiere', width: 18 },    // H - Matière
      { key: 'couleur', width: 15 },    // I - Couleur
      { key: 'madein', width: 18 },     // J - Made in
      { key: 'description', width: 45 }, // K - Description
    ]
    
    // === HEADER ===
    // Ligne 1: vide
    wsProduits.addRow([])
    
    // Ligne 2: NOUVELLE RIVE (titre)
    wsProduits.addRow(['', '', 'NOUVELLE RIVE'])
    wsProduits.mergeCells('C2:F2')
    const titleCell = wsProduits.getCell('C2')
    titleCell.font = { name: 'Helvetica', size: 24, bold: true, color: { argb: NR_BLUE } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    wsProduits.getRow(2).height = 35
    
    // Ligne 3: Sous-titre
    const displayName = userName || (isAdmin && selectedChineuse ? selectedChineuse.nom : 'Chineuse')
    wsProduits.addRow(['', '', `Template d'import · ${displayName}`])
    wsProduits.mergeCells('C3:F3')
    const subtitleCell = wsProduits.getCell('C3')
    subtitleCell.font = { name: 'Helvetica', size: 11, italic: true, color: { argb: GRAY_TEXT } }
    subtitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
    
    // Ligne 4: vide
    wsProduits.addRow([])
    
    // Ligne 5: Instructions
    wsProduits.addRow(['', '', '⚠️ Les champs avec * sont obligatoires. SKU est optionnel (généré auto si vide).'])
    wsProduits.mergeCells('C5:K5')
    const instructionCell = wsProduits.getCell('C5')
    instructionCell.font = { name: 'Helvetica', size: 10, color: { argb: RED } }
    instructionCell.alignment = { horizontal: 'left', vertical: 'middle' }
    
    // Ligne 6: vide
    wsProduits.addRow([])
    
    // === LIGNE D'EN-TÊTE (ligne 7) ===
    const headers = ['SKU', 'Nom *', 'Catégorie *', 'Prix € *', 'Quantité', 'Marque', 'Taille', 'Matière', 'Couleur', 'Made in', 'Description']
    const headerRow = wsProduits.addRow(headers)
    headerRow.height = 28
    
    headerRow.eachCell((cell, colNumber) => {
      // SKU en orange (optionnel), le reste en bleu
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
    
    // === LIGNES DE DONNÉES (lignes 8-57 = 50 lignes) ===
    const DATA_START_ROW = 8
    const DATA_END_ROW = 57
    
    for (let i = 0; i < 50; i++) {
      const dataRow = wsProduits.addRow(['', '', '', '', 1, '', '', '', '', '', ''])
      dataRow.height = 24
      
      dataRow.eachCell((cell, colNumber) => {
        // Alternance de couleurs
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
        
        // SKU en fond orange clair
        if (colNumber === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: i % 2 === 0 ? 'FEF3C7' : 'FDE68A' }
          }
        }
        // Colonnes obligatoires (Nom, Catégorie, Prix) en fond bleu clair
        else if (colNumber >= 2 && colNumber <= 4) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: i % 2 === 0 ? NR_LIGHT_BLUE : 'F0F0FA' }
          }
        }
      })
    }
    
    // === DATA VALIDATION ===
    
    // Catégories (colonne C)
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
    
    // Tailles (colonne G)
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
    
    // Made in (colonne J)
    for (let row = DATA_START_ROW; row <= DATA_END_ROW; row++) {
      wsProduits.getCell(`J${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Listes!$C$2:$C$${MADE_IN_OPTIONS.length + 1}`],
      }
    }
    
    // Prix (colonne D) - validation numérique
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
    
    // Quantité (colonne E) - validation entier
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
    
    // === FEUILLE LISTES (cachée avec les données de validation) ===
    const wsListes = workbook.addWorksheet('Listes', { state: 'veryHidden' })
    
    // Colonne A: Catégories
    wsListes.getCell('A1').value = 'Catégories'
    categoriesAutorisees.forEach((cat, i) => {
      wsListes.getCell(`A${i + 2}`).value = cat
    })
    
    // Colonne B: Tailles
    wsListes.getCell('B1').value = 'Tailles'
    ALL_TAILLES.forEach((taille, i) => {
      wsListes.getCell(`B${i + 2}`).value = taille
    })
    
    // Colonne C: Made in
    wsListes.getCell('C1').value = 'Made in'
    MADE_IN_OPTIONS.forEach((opt, i) => {
      wsListes.getCell(`C${i + 2}`).value = opt
    })
    
    // === FEUILLE AIDE ===
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
        // SKU en orange
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
    
    // === EXPORT ===
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
          
          // Trouver la ligne d'en-tête
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
            
            // On a trouvé les colonnes obligatoires
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
            
            // Ligne vide - on skip
            if (!rec.nom && !rec.categorie && !rec.prix) continue
            
            const rowNum = idx + headersIndex + 2
            
            // Validation
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
            
            // Vérifier catégorie
            if (!categoriesAutorisees.includes(categorie.toLowerCase().trim())) {
              erreurs.push(`Ligne ${rowNum}: Catégorie "${categorie}" non autorisée`)
              continue
            }
            
            // Vérifier que la catégorie a un idsquare
            const catMatch = displayCategories.find(c => c.label.toLowerCase().trim() === categorie.toLowerCase().trim())
            if (!catMatch?.idsquare) {
              erreurs.push(`Ligne ${rowNum}: Catégorie "${categorie}" non configurée dans Square`)
              continue
            }
            
            // Vérifier prix
            if (isNaN(prix) || prix <= 0) {
              erreurs.push(`Ligne ${rowNum}: Prix invalide`)
              continue
            }
            
            // SKU - récupérer tel quel s'il existe
            let skuValue: string | undefined = undefined
            if (rec.sku !== undefined && rec.sku !== null && rec.sku !== '') {
              const skuRaw = rec.sku
              // Gérer le cas où c'est un nombre (Excel peut convertir "5" en 5)
              if (typeof skuRaw === 'number') {
                skuValue = String(skuRaw)
              } else {
                skuValue = String(skuRaw).trim()
              }
              // Si vide après trim, c'est undefined
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
          
          // Résumé avec SKU
          const withSku = produits.filter(p => p.sku).length
          const withoutSku = produits.length - withSku
          let confirmMsg = `📦 ${produits.length} produit(s) à importer.`
          if (withSku > 0) confirmMsg += `\n\n• ${withSku} avec SKU personnalisé`
          if (withoutSku > 0) confirmMsg += `\n• ${withoutSku} avec SKU auto-généré`
          confirmMsg += '\n\nContinuer ?'
          
          if (!confirm(confirmMsg)) {
            setImportLoading(false)
            return
          }
          
          await onExcelImport(produits)
          
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
    
    await onSubmit(formData)
  }

  const defaultSubmitLabel = mode === 'create' ? '✓ Ajouter le produit' : '✓ Enregistrer'

  // =====================
  // RENDER
  // =====================
  return (
    <div className="space-y-4">
      
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
                
                {/* Zone Drag & Drop */}
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
            {/* Nom avec SKU */}
            <div className="col-span-2 md:col-span-3">
              <label className="block text-sm font-medium mb-1">Nom de la pièce</label>
              <div className="flex">
                {sku && (
                  <span className="inline-flex items-center px-2 border border-r-0 rounded-l bg-gray-100 text-gray-600 text-sm">
                    {sku} -
                  </span>
                )}
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  className={`flex-1 border px-2 py-1.5 text-sm ${sku ? 'rounded-r' : 'rounded'}`}
                  placeholder="Nom du produit"
                />
              </div>
            </div>

            {/* SKU */}
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input
                type="text"
                value={sku || '—'}
                readOnly
                className="w-full border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-600"
              />
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-sm font-medium mb-1">Catégorie</label>
              <select
                value={formData.categorie}
                onChange={(e) => setFormData({ ...formData, categorie: e.target.value, taille: '' })}
                required
                disabled={isAdmin && !selectedChineuse}
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

            <div>
              <label className="block text-xs text-gray-600 mb-1">Matière</label>
              <input
                type="text"
                value={formData.material}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="Cuir, Soie..."
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Couleur</label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="Noir, Bleu..."
              />
            </div>

            <div className="col-span-2 md:col-span-4">
              <label className="block text-xs text-gray-600 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm resize-none"
                rows={2}
                placeholder="État, époque, détails..."
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
              <label className="block text-xs font-medium text-blue-700">
                Face {mode === 'create' && '*'}
              </label>
              
              {formData.existingPhotos.face && !formData.deletedPhotos.face && (
                <div className="relative group">
                  <img src={formData.existingPhotos.face} alt="Face" className="w-full h-32 object-cover rounded border" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                    <button type="button" onClick={() => handleDeleteExistingPhoto('face')} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                      <X size={16} />
                    </button>
                  </div>
                  <span className="absolute bottom-1 left-1 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">✓</span>
                </div>
              )}
              
              {/* Zone photo avec boutons Caméra + Upload */}
              <div className="flex gap-2">
                {/* Bouton Caméra */}
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
                
                {/* Zone Drag & Drop */}
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
                      setFormData({ ...formData, photoFace: file })
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
                        onChange={(e) => setFormData({ ...formData, photoFace: e.target.files?.[0] || null })}
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
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                    <button type="button" onClick={() => handleDeleteExistingPhoto('dos')} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                      <X size={16} />
                    </button>
                  </div>
                  <span className="absolute bottom-1 left-1 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">✓</span>
                </div>
              )}
              
              {/* Zone photo avec boutons Caméra + Upload */}
              <div className="flex gap-2">
                {/* Bouton Caméra */}
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
                
                {/* Zone Drag & Drop */}
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
                      setFormData({ ...formData, photoDos: file })
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
                        onChange={(e) => setFormData({ ...formData, photoDos: e.target.files?.[0] || null })}
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
                        <button type="button" onClick={() => handleDeleteExistingPhoto('detail', i)} className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={12} />
                        </button>
                      </div>
                    )
                  ))}
                </div>
              )}
              
              {/* Nouvelles photos détails */}
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
              
              {/* Zone photo avec boutons Caméra + Upload */}
              <div className="flex gap-2">
                {/* Bouton Caméra */}
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
                
                {/* Zone Drag & Drop */}
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
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
                    if (files.length > 0) {
                      setFormData({ ...formData, photosDetails: [...formData.photosDetails, ...files] })
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
                      onChange={(e) => setFormData({ ...formData, photosDetails: [...formData.photosDetails, ...Array.from(e.target.files || [])] })}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Photo portée */}
          {formData.existingPhotos.faceOnModel && !formData.deletedPhotos.faceOnModel && (
            <div className="mt-4 pt-4 border-t">
              <label className="block text-xs font-medium text-purple-600 mb-2">📷 Photo portée (générée automatiquement)</label>
              <div className="relative group w-32 h-32">
                <img src={formData.existingPhotos.faceOnModel} alt="Photo portée" className="w-full h-full object-cover rounded border" />
                <button type="button" onClick={() => handleDeleteExistingPhoto('faceOnModel')} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
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
            disabled={loading || (isAdmin && !selectedChineuse)}
            className={`${onCancel ? 'flex-1' : 'w-full'} bg-[#22209C] text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition`}
          >
            {loading ? '⏳ En cours...' : (submitLabel || defaultSubmitLabel)}
          </button>
        </div>
      </form>
    </div>
  )
}

// Export types
export type { ProductFormData, Cat, Chineuse, ExistingPhotos, ExcelImportData }