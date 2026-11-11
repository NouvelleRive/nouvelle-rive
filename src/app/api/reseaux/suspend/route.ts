import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { adminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { decalerChronique, parisTodayIso } from '@/lib/reseauxDecalage'

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
    // Suspendre = poser le flag + la date de début de pause.
    if (suspended) {
      await DOC.set({ [chronique]: true, since: { [chronique]: parisTodayIso() } }, { merge: true })
      return NextResponse.json({ success: true })
    }
    // Réactiver = reprendre là où on s'était arrêté : les contenus tombés
    // pendant la pause glissent sur les semaines suivantes (aucune perte).
    const snap = await DOC.get()
    const fallback = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)
    const depuis = (snap.data() as any)?.since?.[chronique] || fallback
    const { moved } = await decalerChronique(chronique, depuis)
    await DOC.set({ [chronique]: FieldValue.delete(), since: { [chronique]: FieldValue.delete() } }, { merge: true })
    return NextResponse.json({ success: true, moved })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
