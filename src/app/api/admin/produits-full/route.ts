// app/api/admin/produits-full/route.ts
// Retourne la liste complète des produits pour les pages admin
// (nos-produits, inventaires). Auth admin OU chineuse (côté client, la page
// admin est déjà protégée par middleware — on met l'auth ici pour pas exposer
// les données stock/prix d'achat).
//
// Sert depuis getAllProduitsCached (cache 6h) — 0 read Firestore par appel.

export const runtime = 'nodejs'
export const revalidate = 3600

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
    if (!token) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(token)
    } catch {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    }
    if (decoded.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
    }

    const all = await getAllProduitsCached()
    const produits = all.map(({ id, raw }) => ({ id, ...(raw as any) }))
    return NextResponse.json(
      { success: true, produits },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
