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

    // Récupérer tous les créneaux et filtrer en mémoire pour éviter les problèmes d'index
    const snap = await adminDb.collection('ateliers_creneaux').get()

    let creneaux = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Filtrer par lieu
    if (lieu) {
      creneaux = creneaux.filter((c: any) => c.lieu === lieu)
    }

    // Filtrer par date
    if (start) {
      creneaux = creneaux.filter((c: any) => c.date >= start)
    }
    if (end) {
      creneaux = creneaux.filter((c: any) => c.date <= end)
    }

    // Trier par date puis heure
    creneaux.sort((a: any, b: any) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.heure.localeCompare(b.heure)
    })

    return NextResponse.json({ success: true, creneaux })
  } catch (error: any) {
    console.error('Erreur GET créneaux:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}