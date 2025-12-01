// app/api/ateliers/creneaux/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lieu = searchParams.get('lieu')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!lieu) {
      return NextResponse.json({ error: 'Lieu requis' }, { status: 400 })
    }

    let query = adminDb.collection('ateliers_creneaux')
      .where('lieu', '==', lieu)

    if (start) {
      query = query.where('date', '>=', start)
    }
    if (end) {
      query = query.where('date', '<=', end)
    }

    const snap = await query.orderBy('date').orderBy('heure').get()

    const creneaux = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    return NextResponse.json({ creneaux })
  } catch (error: any) {
    console.error('Erreur GET créneaux:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}