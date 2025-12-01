// app/api/produits/all/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

export async function GET() {
  try {
    const snap = await adminDb.collection('produits')
      .where('vendu', '!=', true)
      .get()

    const produits = snap.docs
      .map(doc => {
        const d = doc.data()
        return {
          id: doc.id,
          sku: d.sku || '',
          nom: d.nom || '',
          trigramme: d.trigramme || '',
          chineurUid: d.chineurUid || '',
          chineur: d.chineur || '',
          prix: d.prix || 0,
          quantite: d.quantite ?? 1,
          statut: d.statut || '',
        }
      })
      .filter(p => p.quantite > 0 && p.statut !== 'supprime' && p.statut !== 'retour')
      .sort((a, b) => a.sku.localeCompare(b.sku))

    return NextResponse.json({ success: true, produits })
  } catch (err: any) {
    console.error('[API PRODUITS ALL]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}