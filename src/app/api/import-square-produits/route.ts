// app/api/import-square-produits/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getFirestore } from 'firebase-admin/firestore'
import { adminAuth } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      nom,
      prix,
      description,
      categorie,
      reportingCategoryId,
      stock,
      chineurNom,
      chineurEmail,
      productId,
      sku,
      marque,
      taille,
      imageUrl,
      imageUrls,
    } = body ?? {}

    console.log('📥 Reçu dans /api/import-square-produits', {
      nom,
      prix,
      categorie,
      reportingCategoryId,
      stock,
      chineurNom,
      sku,
      marque,
      taille,
      hasImage: Boolean(imageUrl),
      hasImages: Array.isArray(imageUrls) && imageUrls.length > 0,
      imageCount: Array.isArray(imageUrls) ? imageUrls.length : (imageUrl ? 1 : 0),
    })

    if (!nom || prix === undefined || prix === null || !chineurNom || stock === undefined) {
      return NextResponse.json(
        { success: false, error: 'Paramètres manquants ou invalides' },
        { status: 400 }
      )
    }

    const { importerProduitsChineuse } = await import('@/lib/square/importerProduitsChineuse')

    const imagesToSend = Array.isArray(imageUrls) && imageUrls.length > 0 
      ? imageUrls 
      : (imageUrl ? [imageUrl] : [])

    const result = await importerProduitsChineuse({
      nom,
      prix: Number(prix),
      description,
      categorie,
      reportingCategoryId,
      sku,
      marque,
      taille,
      stock: Number(stock),
      chineurNom,
      chineurEmail,
      imageUrl: imagesToSend[0],
      imageUrls: imagesToSend,
    } as any)

    // Récupérer les IDs correctement
    const itemId = result?.itemId
    const variationId = result?.variationId
    const catalogObjectId = itemId || variationId // itemId est le catalogObjectId
    const imageId = result?.imageId

    console.log(`✅ Import terminé pour "${nom}"`, {
      catalogObjectId,
      variationId,
      itemId,
      imageId,
      sku,
      marque,
      taille,
      categorie,
      reportingCategoryId,
      imagesUploaded: imagesToSend.length,
    })

    if (productId && (catalogObjectId || variationId || imageId || sku)) {
      const adminDb = getFirestore()
      const updateData: Record<string, any> = {}
      if (catalogObjectId) updateData.catalogObjectId = catalogObjectId
      if (variationId) updateData.variationId = variationId
      if (itemId) updateData.itemId = itemId
      if (imageId) updateData.imageId = imageId
      if (sku) updateData.sku = sku

      await adminDb.collection('produits').doc(String(productId)).set(updateData, { merge: true })
    }

    return NextResponse.json({
      success: true,
      catalogObjectId,
      variationId,
      itemId,
      imageId,
      sku,
    })
  } catch (e: any) {
    console.error('❌ [API IMPORT SQUARE PRODUITS] Erreur attrapée')
    console.error('🧨 Message :', e?.message)
    if (e?.stack) console.error('🧠 Stack :', e.stack)

    if (e?.response?.body) {
      try {
        console.error(
          '📩 Square response body:',
          JSON.stringify(e.response.body, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
        )
      } catch {
        console.warn('⚠️ Impossible d\'afficher le corps de réponse Square')
      }
    }

    return NextResponse.json(
      { success: false, error: e?.message || 'Erreur interne inconnue' },
      { status: 500 }
    )
  }
}