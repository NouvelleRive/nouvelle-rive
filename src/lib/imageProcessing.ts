// lib/imageProcessing.ts
// Traitement d'images : upload Cloudinary + détourage Replicate + transformations

/**
 * Configuration Cloudinary
 */
function getBunnyConfig() {
  const storageZone = process.env.NEXT_PUBLIC_BUNNY_STORAGE_ZONE
  const apiKey = process.env.BUNNY_API_KEY
  const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL

  if (!storageZone || !apiKey || !cdnUrl) {
    throw new Error('Configuration Bunny manquante dans .env.local')
  }

  return { storageZone, apiKey, cdnUrl }
}

function generateFilename(prefix: string, extension: string = 'png'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}_${random}.${extension}`
}

/**
 * Upload une image vers Bunny CDN via l'API route
 */
async function uploadToBunny(file: File | Blob, folder: string, filename?: string): Promise<string> {
  const finalFilename = filename || generateFilename('img', 'png')
  const path = `${folder}/${finalFilename}`

  const arrayBuffer = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

  const response = await fetch('/api/upload-bunny', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, path, contentType: file.type || 'image/png' })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Erreur upload Bunny: ${error.error || response.status}`)
  }

  const data = await response.json()
  return data.url
}

/**
 * Applique les transformations Cloudinary (lumière, contraste, fond blanc, etc.)
 */
function applyTransformations(url: string, withBackground: boolean = true): string {
  const urlParts = url.split('/upload/')
  if (urlParts.length !== 2) return url

  const transforms = withBackground
    ? 'b_white,c_lpad,ar_1:1,w_1200,h_1200,g_center,e_auto_brightness,e_auto_contrast,e_brightness:8,e_gamma:105,e_vibrance:20,e_sharpen:40,q_auto:best,f_auto'
    : 'c_pad,ar_1:1,w_1200,h_1200,g_center,e_auto_brightness,e_auto_contrast,e_brightness:5,e_vibrance:15,e_sharpen:30,q_auto:good,f_auto'

  return `${urlParts[0]}/upload/${transforms}/${urlParts[1]}`
}

/**
 * Upload et traite une photo produit (face/dos)
 * Retourne original + processed (avec transformations basiques, sans détourage)
 * Le détourage se fait via PhotoEditor
 */
export async function processAndUploadProductPhoto(file: File): Promise<{
  original: string
  processed: string
}> {
  console.log('📸 Upload photo produit:', file.name)

  const originalUrl = await uploadToCloudinary(file)
  
  // Appliquer rotation EXIF
  const urlParts = originalUrl.split('/upload/')
  const exifUrl = urlParts.length === 2
    ? `${urlParts[0]}/upload/a_exif/${urlParts[1]}`
    : originalUrl

  // Transformations basiques sans détourage
  const processedUrl = applyTransformations(exifUrl, false)

  return { original: exifUrl, processed: processedUrl }
}

/**
 * Détoure une image via Replicate (lucataco/remove-bg)
 * Appelé depuis PhotoEditor
 */
export async function removeBackground(imageUrl: string): Promise<string> {
  console.log('🔄 Détourage Replicate pour:', imageUrl)

  // Appel API Replicate
  const response = await fetch('/api/segment-sam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  })

  const data = await response.json()

  if (!data.success || !data.maskUrl) {
    throw new Error(data.error || 'Erreur détourage')
  }

  return data.maskUrl
}

/**
 * Upload simple pour photos détails (sans détourage)
 */
export async function uploadPhotoSimple(file: File): Promise<{
  original: string
  processed: string
}> {
  console.log('📸 Upload photo détail:', file.name)

  const originalUrl = await uploadToCloudinary(file)
  
  // Transformations légères
  const urlParts = originalUrl.split('/upload/')
  const processedUrl = urlParts.length === 2
    ? `${urlParts[0]}/upload/a_auto,c_fill,g_auto,ar_1:1,w_1200,h_1200,e_auto_color,e_auto_brightness,e_auto_contrast,e_brightness:5,e_gamma:102,e_vibrance:10,e_sharpen:30,q_auto:good,f_auto/${urlParts[1]}`
    : originalUrl

  return { original: originalUrl, processed: processedUrl }
}

/**
 * Upload plusieurs photos détails
 */
export async function uploadMultiplePhotos(files: File[]): Promise<string[]> {
  if (!files || files.length === 0) return []
  
  const results = await Promise.all(files.map(f => uploadPhotoSimple(f)))
  return results.map(r => r.processed)
}

/**
 * Vérifie si une catégorie est compatible avec FASHN.ai
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
 * Génère une photo portée via FASHN.ai
 */
export async function generateTryonPhoto(
  imageUrl: string, 
  productName: string
): Promise<string | null> {
  try {
    const response = await fetch('/api/generate-tryon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, productName })
    })

    if (!response.ok) return null

    const data = await response.json()
    return data.success && data.onModelUrl ? data.onModelUrl : null
  } catch {
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