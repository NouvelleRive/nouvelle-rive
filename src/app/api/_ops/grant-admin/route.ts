import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'

const ALLOWED_EMAIL = 'nouvelleriveparis@gmail.com' // <- ton email admin

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded.email !== ALLOWED_EMAIL) {
      return NextResponse.json({ ok: false, error: 'Interdit' }, { status: 403 })
    }
    await adminAuth.setCustomUserClaims(decoded.uid, { admin: true })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
