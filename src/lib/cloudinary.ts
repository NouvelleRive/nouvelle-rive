// lib/cloudinary.ts
// Helper pour uploader des images vers Cloudinary

/**
 * Upload une image vers Cloudinary
 * @param file - Le fichier image à uploader
 * @returns L'URL sécurisée de l'image uploadée
 */
export async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('Configuration Cloudinary manquante dans .env.local')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'produits')

  console.log('📸 Upload vers Cloudinary →', file.name, `(${(file.size / 1024).toFixed(1)} KB)`)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Erreur Cloudinary:', errorText)
    throw new Error(`Erreur upload Cloudinary: ${response.status}`)
  }

  const data = await response.json()
  
  // ✅ Construire l'URL avec transformation pour format carré e-commerce
  // Format: cloudinary.com/[cloud]/image/upload/w_1200,h_1200,c_fill,g_auto,q_auto:good,f_jpg/[public_id]
  const baseUrl = data.secure_url
  const urlParts = baseUrl.split('/upload/')
  
  if (urlParts.length === 2) {
    // Insérer les transformations juste après "/upload/"
    const transformedUrl = `${urlParts[0]}/upload/w_1200,h_1200,c_fill,g_auto,q_auto:good,f_jpg/${urlParts[1]}`
    console.log('✅ Image uploadée avec transformation carré:', transformedUrl)
    return transformedUrl
  }
  
  // Fallback si le format d'URL est inattendu
  console.log('✅ Image uploadée (URL originale):', data.secure_url)
  return data.secure_url
}

/**
 * Upload plusieurs images vers Cloudinary en parallèle
 * @param files - Tableau de fichiers à uploader
 * @returns Tableau des URLs uploadées
 */
export async function uploadMultipleToCloudinary(files: File[]): Promise<string[]> {
  if (!files || files.length === 0) return []
  
  console.log(`📸 Upload de ${files.length} image(s)...`)
  const uploads = files.map((file) => uploadToCloudinary(file))
  const urls = await Promise.all(uploads)
  console.log(`✅ ${urls.length} image(s) uploadée(s)`)
  
  return urls
}