// app/api/reseaux/swap/route.ts
// Échange le contenu de deux créneaux (dates) d'une chronique → réorganisation.
// Les dates (ids) restent fixes ; on permute tous les champs de contenu.

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

const COLL = 'reseauxContenu'
const FIELDS = ['theme', 'objectif', 'format', 'videoUrl', 'vignetteUrl', 'medias', 'caption', 'heurePost', 'cta', 'lieu', 'collab', 'status', 'igMediaId', 'publishedAt']

export async function POST(req: NextRequest) {
  try {
    const { chronique, dateA, dateB } = await req.json()
    if (!chronique || !dateA || !dateB || dateA === dateB) {
      return NextResponse.json({ success: false, error: 'chronique/dateA/dateB requis' }, { status: 400 })
    }
    const refA = adminDb.collection(COLL).doc(`${chronique}_${dateA}`)
    const refB = adminDb.collection(COLL).doc(`${chronique}_${dateB}`)
    const [snapA, snapB] = await adminDb.getAll(refA, refB)
    const dataA = snapA.exists ? (snapA.data() as any) : {}
    const dataB = snapB.exists ? (snapB.data() as any) : {}

    const pick = (d: any) => Object.fromEntries(FIELDS.map((f) => [f, d[f] ?? null]))
    const contentA = pick(dataA)
    const contentB = pick(dataB)

    await refA.set({ chronique, date: dateA, ...contentB, updatedAt: Date.now() }, { merge: true })
    await refB.set({ chronique, date: dateB, ...contentA, updatedAt: Date.now() }, { merge: true })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
