// lib/imageProcessing.ts
// Traitement d'images centralisé : détourage, fond blanc, redressement, lumière, netteté

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
 * Construit l'URL avec transformations e-commerce PRO
 * 
 * Transformations appliquées :
 * - e_background_removal : Détourage IA (supprime le fond)
 * - b_white : Fond blanc propre
 * - a_auto : Redresse automatiquement le vêtement
 * - e_trim : Centre le produit (supprime bords vides)
 * - e_improve : Amélioration globale IA
 * - e_auto_brightness : Luminosité optimale
 * - e_auto_contrast : Contraste équilibré
 * - e_vibrance:15 : Couleurs naturellement vives
 * - e_sharpen:80 : Netteté
 * - e_shadow:40 : Ombre légère (donne du relief)
 * - c_pad,ar_1:1 : Format carré avec padding
 * - w_1200,h_1200 : Dimensions e-commerce standard
 * - q_auto:best : Qualité maximale
 * - f_auto : Format optimal (WebP/AVIF)
 */
function buildProcessedUrl(baseUrl: string): string {
  const urlParts = baseUrl.split('/upload/')
  
  if (urlParts.length !== 2) {
    console.warn('⚠️ Format URL inattendu')
    return baseUrl
  }

  const transformations = [
    'e_background_removal',   // Détourage IA
    'b_white',                // Fond blanc
    'a_auto',                 // Redresse le vêtement
    'e_trim',                 // Centre le produit
    'e_improve',              // Amélioration globale IA
    'e_auto_brightness',      // Luminosité optimale
    'e_auto_contrast',        // Contraste équilibré
    'e_vibrance:15',          // Couleurs vives naturelles
    'e_sharpen:80',           // Netteté
    'e_shadow:40',            // Ombre légère pour le relief
    'c_pad',                  // Padding (garde le produit entier)
    'ar_1:1',                 // Ratio carré
    'w_1200',                 // Largeur
    'h_1200',                 // Hauteur
    'q_auto:best',            // Qualité maximale
    'f_auto'                  // Format auto (WebP si supporté)
  ].join(',')

  return `${urlParts[0]}/upload/${transformations}/${urlParts[1]}`
}

/**
 * Construit l'URL avec transformations légères (pour photos détails)
 * Pas de détourage, juste amélioration lumière + recadrage
 */
function buildSimpleUrl(baseUrl: string): string {
  const urlParts = baseUrl.split('/upload/')
  
  if (urlParts.length !== 2) return baseUrl

  const transformations = [
    'e_improve',              // Amélioration globale
    'e_auto_brightness',      // Luminosité
    'e_auto_contrast',        // Contraste
    'e_sharpen:60',           // Netteté légère
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
 * @returns { original: URL photo chineuse, processed: URL fond blanc }
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
  console.log('✅ Photo traitée (fond blanc + lumière + netteté):', processed)
  
  return { original, processed }
}

/**
 * Upload simple pour photos détails (sans détourage)
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
  
  // Pour les détails, on retourne les versions traitées
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
 * 
 * @param imageUrl - URL de l'image du vêtement
 * @param productName - Nom du produit (pour les logs)
 * @returns URL de la photo portée ou null si échec
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
  face?: string           // URL traitée (fond blanc)
  faceOriginal?: string   // URL originale (photo chineuse)
  dos?: string            // URL traitée
  dosOriginal?: string    // URL originale
  details: string[]       // URLs traitées
}

/**
 * Traite toutes les photos d'un produit
 * - Face/Dos : détourage + fond blanc + lumière (garde aussi l'original)
 * - Détails : amélioration lumière sans détourage
 * 
 * ⚠️ FASHN.ai n'est PAS appelé ici - utiliser le bouton ✨ manuellement
 * 
 * @param photos - Objet contenant les fichiers photos
 * @returns Objet avec les URLs originales et traitées
 */
export async function processProductPhotos(
  photos: {
    face?: File | null
    dos?: File | null
    details?: File[]
  }
): Promise<ProcessedPhotos> {
  const result: ProcessedPhotos = { details: [] }

  // Photo Face - traitement complet + conservation original
  if (photos.face) {
    const { original, processed } = await processAndUploadProductPhoto(photos.face)
    result.face = processed
    result.faceOriginal = original
  }

  // Photo Dos - traitement complet + conservation original
  if (photos.dos) {
    const { original, processed } = await processAndUploadProductPhoto(photos.dos)
    result.dos = processed
    result.dosOriginal = original
  }

  // Photos Détails - amélioration sans détourage
  if (photos.details && photos.details.length > 0) {
    result.details = await uploadMultiplePhotos(photos.details)
  }

  return result
}