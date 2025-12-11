// lib/imageProcessing.ts
// Traitement d'images : upload Cloudinary + détourage Replicate

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
 */
async function uploadRaw(file: File): Promise<string> {
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
    throw new Error(`Erreur upload Cloudinary: ${response.status}`)
  }

  const data = await response.json()
  return data.secure_url
}

/**
 * Upload une image depuis une URL vers Cloudinary
 */
async function uploadFromUrl(imageUrl: string): Promise<string> {
  const { cloudName, uploadPreset } = getCloudinaryConfig()

  const formData = new FormData()
  formData.append('file', imageUrl)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'produits-detoures')

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!response.ok) {
    throw new Error(`Erreur upload Cloudinary: ${response.status}`)
  }

  const data = await response.json()
  
  // Ajouter fond blanc + recadrage carré
  const baseUrl = data.secure_url
  const urlParts = baseUrl.split('/upload/')
  if (urlParts.length === 2) {
    return `${urlParts[0]}/upload/b_white,c_pad,ar_1:1,w_1200,h_1200,q_auto:good,f_auto/${urlParts[1]}`
  }
  return baseUrl
}

/**
 * Appelle l'API de détourage (Replicate rembg)
 */
async function removeBackground(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch('/api/remove-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl })
    })

    if (!response.ok) {
      console.warn('⚠️ Détourage échoué:', response.status)
      return null
    }

    const data = await response.json()
    return data.removedBgUrl || null
  } catch (error) {
    console.warn('⚠️ Erreur détourage:', error)
    return null
  }
}

/**
 * Upload et traite une photo produit (face/dos)
 * - Upload original sur Cloudinary
 * - Détourage via Replicate
 * - Re-upload image détourée sur Cloudinary avec fond blanc
 */
export async function processAndUploadProductPhoto(file: File): Promise<{
  original: string
  processed: string
}> {
  console.log('📸 Upload photo produit:', file.name, `(${(file.size / 1024).toFixed(1)} KB)`)

  // 1. Upload original sur Cloudinary
  const originalUrl = await uploadRaw(file)
  console.log('✅ Photo originale:', originalUrl)

  // 2. Détourage via Replicate
  const removedBgUrl = await removeBackground(originalUrl)
  
  if (removedBgUrl) {
    // 3. Upload image détourée sur Cloudinary avec fond blanc
    const processedUrl = await uploadFromUrl(removedBgUrl)
    console.log('✅ Photo détourée (fond blanc):', processedUrl)
    return { original: originalUrl, processed: processedUrl }
  }

  // Fallback si détourage échoue : recadrage simple
  console.log('⚠️ Fallback: recadrage simple sans détourage')
  const urlParts = originalUrl.split('/upload/')
  const fallbackUrl = urlParts.length === 2
    ? `${urlParts[0]}/upload/c_fill,g_auto,ar_1:1,w_1200,h_1200,q_auto:good,f_auto/${urlParts[1]}`
    : originalUrl

  return { original: originalUrl, processed: fallbackUrl }
}

/**
 * Upload simple pour photos détails (sans détourage)
 */
export async function uploadPhotoSimple(file: File): Promise<{
  original: string
  processed: string
}> {
  console.log('📸 Upload photo détail:', file.name)

  const originalUrl = await uploadRaw(file)
  
  // Transformations légères (pas de détourage)
  const urlParts = originalUrl.split('/upload/')
  const processedUrl = urlParts.length === 2
    ? `${urlParts[0]}/upload/c_fill,g_auto,ar_1:1,w_1200,h_1200,q_auto:good,f_auto/${urlParts[1]}`
    : originalUrl

  return { original: originalUrl, processed: processedUrl }
}

/**
 * Upload plusieurs photos détails
 */
export async function uploadMultiplePhotos(files: File[]): Promise<string[]> {
  if (!files || files.length === 0) return []
  
  console.log(`📸 Upload de ${files.length} photo(s) détail...`)
  
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