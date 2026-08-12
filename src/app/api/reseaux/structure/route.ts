import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

// Structure (fiche informative) d'une chronique : accroche + 4 plans.
// 1 doc par chronique : reseauxStructure/{chronique}. Gratuit.

const COLL = 'reseauxStructure'
const FIELDS = ['accroche', 'plan1', 'plan2', 'plan3', 'plan4'] as const

export async function GET(req: NextRequest) {
  try {
    const chronique = req.nextUrl.searchParams.get('chronique') || ''
    if (!chronique) return NextResponse.json({ success: false, error: 'chronique requise' }, { status: 400 })
    const snap = await adminDb.collection(COLL).doc(chronique).get()
    const data = snap.exists ? (snap.data() as any) : {}
    const structure = Object.fromEntries(FIELDS.map((f) => [f, data[f] || '']))
    return NextResponse.json({ success: true, structure })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { chronique } = body
    if (!chronique) return NextResponse.json({ success: false, error: 'chronique requise' }, { status: 400 })
    const payload: Record<string, any> = { updatedAt: Date.now() }
    FIELDS.forEach((f) => { payload[f] = body[f] ?? '' })
    await adminDb.collection(COLL).doc(chronique).set(payload, { merge: true })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
