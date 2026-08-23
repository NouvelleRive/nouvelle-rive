import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { adminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

// Chroniques suspendues (auto-publish en pause). 1 doc unique
// reseauxConfig/suspended = map { [chronique]: true }. Gratuit (1 read).

const DOC = adminDb.collection('reseauxConfig').doc('suspended')

export async function GET() {
  try {
    const snap = await DOC.get()
    const data = snap.exists ? (snap.data() as Record<string, any>) : {}
    const suspended = Object.keys(data).filter((k) => data[k] === true)
    return NextResponse.json({ success: true, suspended })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { chronique, suspended } = await req.json()
    if (!chronique) return NextResponse.json({ success: false, error: 'chronique requise' }, { status: 400 })
    // Suspendre = poser le flag ; réactiver = le supprimer (doc reste léger).
    await DOC.set({ [chronique]: suspended ? true : FieldValue.delete() }, { merge: true })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
