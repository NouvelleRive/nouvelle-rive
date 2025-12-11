// lib/imageProcessing.ts
// Traitement d'images centralisé : amélioration lumière, recadrage carré

/**
 * Configuration Cloudinary
 */
function getCloudinaryConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('Configuration Cloudinary manquante dans .env.local')
  }

  return { cloudName, uploadPreset }
}

/**
 * Upload une image vers Cloudinary (sans transformation)
 * @returns URL originale
 */
async function uploadRaw(file: File): Promise<{ secure_url: string; public_id: string }> {
  const { cloudName, uploadPreset } = getCloudinaryConfig()

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'produits')

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Erreur Cloudinary upload:', errorText)
    throw new Error(`Erreur upload Cloudinary: ${response.status}`)
  }

  return response.json()
}

/**
 * Construit l'URL avec transformations e-commerce (GRATUITES)
 * 
 * Transformations appliquées :
 * - c_fill : Remplissage intelligent
 * - g_auto : Focus auto sur le sujet
 * - ar_1:1 : Format carré
 * - w_1200,h_1200 : Dimensions e-commerce standard
 * - q_auto:good : Bonne qualité
 * - f_auto : Format optimal (WebP/AVIF)
 */
function buildProcessedUrl(baseUrl: string): string {
  const urlParts = baseUrl.split('/upload/')
  
  if (urlParts.length !== 2) {
    console.warn('⚠️ Format URL inattendu')
    return baseUrl
  }

  const transformations = [
    'c_fill',                 // Remplissage intelligent
    'g_auto',                 // Focus auto sur le sujet
    'ar_1:1',                 // Ratio carré
    'w_1200',                 // Largeur
    'h_1200',                 // Hauteur
    'q_auto:good',            // Bonne qualité
    'f_auto'                  // Format auto (WebP si supporté)
  ].join(',')

  return `${urlParts[0]}/upload/${transformations}/${urlParts[1]}`
}

/**
 * Construit l'URL avec transformations légères (pour photos détails)
 */
function buildSimpleUrl(baseUrl: string): string {
  const urlParts = baseUrl.split('/upload/')
  
  if (urlParts.length !== 2) return baseUrl

  const transformations = [
    'c_fill',                 // Remplissage
    'g_auto',                 // Focus auto sur le sujet
    'ar_1:1',                 // Carré
    'w_1200',                 // Largeur
    'h_1200',                 // Hauteur
    'q_auto:good',            // Bonne qualité
    'f_auto'                  // Format auto
  ].join(',')

  return `${urlParts[0]}/upload/${transformations}/${urlParts[1]}`
}

/**
 * Upload et traite une photo produit (face/dos)
 * Retourne l'URL originale ET l'URL traitée
 * 
 * @param file - Le fichier image à uploader
 * @returns { original: URL photo chineuse, processed: URL recadrée }
 */
export async function processAndUploadProductPhoto(file: File): Promise<{
  original: string
  processed: string
}> {
  console.log('📸 Upload + traitement photo produit:', file.name, `(${(file.size / 1024).toFixed(1)} KB)`)

  const data = await uploadRaw(file)
  
  const original = data.secure_url
  const processed = buildProcessedUrl(original)
  
  console.log('✅ Photo originale:', original)
  console.log('✅ Photo traitée:', processed)
  
  return { original, processed }
}

/**
 * Upload simple pour photos détails
 * Retourne original + version améliorée
 * 
 * @param file - Le fichier image à uploader
 * @returns { original: URL brute, processed: URL améliorée }
 */
export async function uploadPhotoSimple(file: File): Promise<{
  original: string
  processed: string
}> {
  console.log('📸 Upload photo détail:', file.name)

  const data = await uploadRaw(file)
  
  const original = data.secure_url
  const processed = buildSimpleUrl(original)
  
  return { original, processed }
}

/**
 * Upload plusieurs photos détails
 * 
 * @param files - Tableau de fichiers
 * @returns Tableau des URLs traitées
 */
export async function uploadMultiplePhotos(files: File[]): Promise<string[]> {
  if (!files || files.length === 0) return []
  
  console.log(`📸 Upload de ${files.length} photo(s) détail...`)
  
  const results = await Promise.all(files.map(f => uploadPhotoSimple(f)))
  
  return results.map(r => r.processed)
}

/**
 * Vérifie si une catégorie est compatible avec FASHN.ai (photo portée)
 * Exclut : bijoux, chaussures, accessoires
 */
export function canUseFashnAI(categorie: string): boolean {
  const cat = (categorie || '').toLowerCase()
  
  const excluded = [
    'bague', 'boucle', 'collier', 'bracelet', 'broche', 'charms', 'earcuff', 'piercing',
    'bijou', 'bijoux',
    'chaussure', 'basket', 'botte', 'bottine', 'sandale', 'escarpin', 'mocassin',
    'derby', 'loafer', 'sneaker', 'talon',
    'ceinture', 'sac', 'foulard', 'écharpe', 'lunettes', 'chapeau', 'bonnet', 
    'casquette', 'gant', 'montre', 'porte clef', 'porte briquet', 'accessoire', 'vase'
  ]
  
  return !excluded.some(term => cat.includes(term))
}

/**
 * Génère une photo portée via FASHN.ai (appelé manuellement via bouton ✨)
 */
export async function generateTryonPhoto(
  imageUrl: string, 
  productName: string
): Promise<string | null> {
  try {
    console.log('🤖 Génération photo portée pour:', productName)
    
    const response = await fetch('/api/generate-tryon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, productName })
    })

    if (!response.ok) {
      console.warn('⚠️ Erreur API generate-tryon:', response.status)
      return null
    }

    const data = await response.json()
    
    if (data.success && data.onModelUrl) {
      console.log('✅ Photo portée générée:', data.onModelUrl)
      return data.onModelUrl
    }
    
    console.warn('⚠️ Pas de photo portée dans la réponse')
    return null
    
  } catch (error) {
    console.warn('⚠️ Erreur génération photo portée:', error)
    return null
  }
}

/**
 * Type de retour pour processProductPhotos
 */
export type ProcessedPhotos = {
  face?: string
  faceOriginal?: string
  dos?: string
  dosOriginal?: string
  details: string[]
}

/**
 * Traite toutes les photos d'un produit
 */
export async function processProductPhotos(
  photos: {
    face?: File | null
    dos?: File | null
    details?: File[]
  }
): Promise<ProcessedPhotos> {
  const result: ProcessedPhotos = { details: [] }

  if (photos.face) {
    const { original, processed } = await processAndUploadProductPhoto(photos.face)
    result.face = processed
    result.faceOriginal = original
  }

  if (photos.dos) {
    const { original, processed } = await processAndUploadProductPhoto(photos.dos)
    result.dos = processed
    result.dosOriginal = original
  }

  if (photos.details && photos.details.length > 0) {
    result.details = await uploadMultiplePhotos(photos.details)
  }

  return result
}