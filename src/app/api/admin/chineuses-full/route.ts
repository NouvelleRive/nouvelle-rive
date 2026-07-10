// app/api/admin/chineuses-full/route.ts
// Liste chineuses avec champs privés (nom, iban, bic, raisonSociale, taux)
// pour les 4 pages admin (paiements, vendeuses, nos-produits, inventaires).
// Auth admin obligatoire. Sert depuis getChineusesFullCached (cache 1h).

export const runtime = 'nodejs'
export const revalidate = 3600

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
import { getChineusesFullCached } from '@/lib/getChineusesFullCached'

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

    const chineuses = await getChineusesFullCached()
    return NextResponse.json(
      { success: true, chineuses },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
