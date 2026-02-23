// app/api/ebay/publish/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { publishToEbay, prepareProductForEbay, wearTypeToGender, isEbayConfigured, type EbayGender } from '@/lib/ebay'

// Init Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()

// Cache des wearType par trigramme pour éviter les requêtes répétées
const chineuseWearTypeCache: Map<string, string> = new Map()

/**
 * Récupère le wearType d'une chineuse par son trigramme
 */
async function getWearTypeByTrigramme(trigramme: string): Promise<string | null> {
  if (!trigramme) return null

  const normalizedTri = trigramme.toUpperCase().trim()

  // Vérifier le cache
  if (chineuseWearTypeCache.has(normalizedTri)) {
    return chineuseWearTypeCache.get(normalizedTri) || null
  }

  try {
    const snapshot = await db.collection('chineuse')
      .where('trigramme', '==', normalizedTri)
      .limit(1)
      .get()

    if (!snapshot.empty) {
      const wearType = snapshot.docs[0].data().wearType || 'womenswear'
      chineuseWearTypeCache.set(normalizedTri, wearType)
      return wearType
    }
  } catch (error) {
    console.error('Erreur récupération chineuse:', error)
  }

  return null
}

/**
 * POST /api/ebay/publish
 * Publie un ou plusieurs produits sur eBay
 *
 * Body: { productId: string, gender?: 'women' | 'men' } ou { productIds: string[], gender?: 'women' | 'men' }
 * gender est optionnel - si non fourni, sera déterminé par le wearType de la chineuse
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier config eBay
    if (!isEbayConfigured()) {
      return NextResponse.json(
        { error: 'eBay non configuré. Ajoutez les clés API dans .env.local' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const productIds: string[] = body.productIds || (body.productId ? [body.productId] : [])
    // Convertir le genre du frontend (FR) vers le format eBay (EN)
    const genderMap: Record<string, EbayGender> = { 'Femme': 'women', 'Homme': 'men', 'Unisexe': 'women', 'women': 'women', 'men': 'men' }
    const forcedGender: EbayGender | undefined = genderMap[body.gender] || undefined

    if (productIds.length === 0) {
      return NextResponse.json(
        { error: 'productId ou productIds requis' },
        { status: 400 }
      )
    }

    const results: Array<{
      productId: string
      success: boolean
      listingId?: string
      error?: string
    }> = []

    for (const productId of productIds) {
      try {
        // Récupérer le produit Firebase
        let docRef = db.collection('produits').doc(productId)
        let docSnap = await docRef.get()

        // Si pas trouvé par ID, chercher par SKU
        if (!docSnap.exists) {
          const skuQuery = await db.collection('produits').where('sku', '==', productId).limit(1).get()
          if (skuQuery.empty) {
            results.push({ productId, success: false, error: 'Produit non trouvé' })
            continue
          }
          docSnap = skuQuery.docs[0]
          docRef = docSnap.ref
        }

        const produitData: any = { id: docSnap.id, ...docSnap.data() }

        // Vérifications
        if (produitData.vendu) {
          results.push({ productId, success: false, error: 'Produit déjà vendu' })
          continue
        }

        if ((produitData.quantite || 1) <= 0) {
          results.push({ productId, success: false, error: 'Stock épuisé' })
          continue
        }

        if (produitData.ebayListingId) {
          results.push({ productId, success: false, error: 'Déjà publié sur eBay' })
          continue
        }

        // Déterminer le genre du produit
        let gender: EbayGender | undefined = forcedGender

        if (!gender) {
          // Récupérer le trigramme du produit (champ chineuse ou extrait du SKU)
          const trigramme = produitData.chineuse ||
            produitData.trigramme ||
            (produitData.sku ? produitData.sku.match(/^([A-Z]{2,4})/i)?.[1] : null)

          if (trigramme) {
            const wearType = await getWearTypeByTrigramme(trigramme)
            gender = wearTypeToGender(wearType || undefined) || undefined
          }
        }

        // Préparer et publier avec le genre
        const ebayProduct = prepareProductForEbay(produitData, gender)

        if (ebayProduct.imageUrls.length === 0) {
          results.push({ productId, success: false, error: 'Aucune image disponible' })
          continue
        }

        const result = await publishToEbay(ebayProduct)

        if (result.success) {
          // Mettre à jour Firebase avec les IDs eBay
          await docRef.update({
            ebayListingId: result.listingId,
            ebayOfferId: result.offerId,
            ebayPublishedAt: new Date().toISOString(),
            publishedOn: [...(produitData.publishedOn || []), 'ebay'],
          })

          results.push({
            productId,
            success: true,
            listingId: result.listingId,
          })
        } else {
          results.push({
            productId,
            success: false,
            error: result.error,
          })
        }

      } catch (error: any) {
        results.push({
          productId,
          success: false,
          error: error?.message || 'Erreur inconnue',
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount} publié(s), ${failCount} échec(s)`,
      results,
    })

  } catch (error: any) {
    console.error('❌ Erreur API publish eBay:', error)
    return NextResponse.json(
      { error: error?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ebay/publish
 * Vérifie le statut de la configuration eBay
 */
export async function GET() {
  return NextResponse.json({
    configured: isEbayConfigured(),
    environment: process.env.EBAY_ENVIRONMENT || 'sandbox',
  })
}