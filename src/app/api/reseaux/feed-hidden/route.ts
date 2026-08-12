import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

// IDs de posts/reels masqués manuellement de l'aperçu Feed
// (l'API IG n'expose pas « retiré de la grille »). 1 doc, gratuit.

const DOC = adminDb.collection('reseauxConfig').doc('feedHidden')

export async function GET() {
  try {
    const snap = await DOC.get()
    const ids = snap.exists ? ((snap.data() as any).ids || []) : []
    return NextResponse.json({ success: true, ids })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, hidden } = await req.json()
    if (!id) return NextResponse.json({ success: false, error: 'id requis' }, { status: 400 })
    await DOC.set(
      { ids: hidden ? FieldValue.arrayUnion(id) : FieldValue.arrayRemove(id) },
      { merge: true },
    )
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
