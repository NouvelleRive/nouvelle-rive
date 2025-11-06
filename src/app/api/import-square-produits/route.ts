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
      codeBarre,
      categorie,
      stock,
      chineurNom,
      chineurEmail,
      productId, // 👈 on récupère aussi l'ID Firestore du produit
    } = body ?? {}

    console.log('📥 Reçu dans /api/import-square-produits', {
      nom,
      categorie,
      stock,
      chineurNom,
    })

    if (!nom || prix === undefined || prix === null || !chineurNom || stock === undefined) {
      return NextResponse.json(
        { success: false, error: 'Paramètres manquants ou invalides' },
        { status: 400 }
      )
    }

    const { importerProduitsChineuse } = await import('@/lib/square/importerProduitsChineuse')

    const result = await importerProduitsChineuse({
      nom,
      prix: Number(prix),
      description,
      codeBarre,
      categorie,
      stock: Number(stock),
      chineurNom,
    } as any)

    const catalogObjectId =
      (result && (result.catalogObjectId || (result as any).catalogObjectId)) || undefined
    const variationId = result?.variationId
    const itemId = result?.itemId

    console.log(`✅ Import terminé pour le produit "${nom}"`, { catalogObjectId, variationId, itemId })

    // === NEW ===
    // On met à jour le document Firestore du produit avec les IDs Square retournés
    if (productId && catalogObjectId) {
      const adminDb = getFirestore()
      await adminDb
        .collection('produits')
        .doc(String(productId))
        .set(
          {
            catalogObjectId,
            variationId,
            itemId,
          },
          { merge: true }
        )
    }

    return NextResponse.json({ success: true, catalogObjectId, variationId, itemId })
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
        console.warn('⚠️ Impossible d’afficher le corps de réponse Square')
      }
    }

    return NextResponse.json(
      { success: false, error: e?.message || 'Erreur interne inconnue' },
      { status: 500 }
    )
  }
}
