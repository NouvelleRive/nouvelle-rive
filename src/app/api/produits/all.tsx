// app/api/produits/all/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

export async function GET(req: NextRequest) {
  try {
    // Récupérer tous les produits disponibles (non vendus, stock > 0)
    const snapshot = await adminDb.collection('produits')
      .where('vendu', '!=', true)
      .get()

    const produits = snapshot.docs
      .map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          sku: data.sku || '',
          nom: data.nom || '',
          trigramme: data.trigramme || '',
          chineur: data.chineur || '',
          chineurUid: data.chineurUid || '',
          prix: data.prix || 0,
          quantite: data.quantite ?? 1,
          vendu: data.vendu || false,
          statut: data.statut || '',
        }
      })
      .filter(p => (p.quantite > 0) && p.statut !== 'supprime' && p.statut !== 'retour')
      .sort((a, b) => a.sku.localeCompare(b.sku))

    return NextResponse.json({ 
      success: true, 
      produits,
      count: produits.length 
    })
  } catch (err: any) {
    console.error('[API PRODUITS ALL]', err)
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    )
  }
}