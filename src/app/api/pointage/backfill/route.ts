// app/api/pointage/backfill/route.ts
// Backfill ponctuel : crée les pointages manquants depuis le planning du mois,
// pour les dates situées entre fromDate et toDate (inclus). Les pointages existants
// ne sont pas écrasés. Réservé admin.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

async function isAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return false
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return decoded?.email === ADMIN_EMAIL
  } catch {
    return false
  }
}

// Construit une Date Paris (CEST en mai = UTC+2, CET en hiver = UTC+1).
// On laisse le moteur JS interpréter en local du serveur n'importe quoi —
// on utilise un offset explicite +02:00 si le mois est entre avril et octobre, sinon +01:00.
function parisISO(dateStr: string, hour: number): string {
  const month = parseInt(dateStr.slice(5, 7), 10)
  const offset = month >= 4 && month <= 10 ? '+02:00' : '+01:00'
  return `${dateStr}T${String(hour).padStart(2, '0')}:00:00${offset}`
}

export async function POST(req: NextRequest) {
  try {
    if (!await isAdmin(req)) {
      return NextResponse.json({ success: false, error: 'Admin requis' }, { status: 403 })
    }
    const { mois, fromDate, toDate } = await req.json()
    if (!mois || !fromDate || !toDate) {
      return NextResponse.json({ success: false, error: 'mois, fromDate, toDate requis' }, { status: 400 })
    }

    const planSnap = await adminDb.collection('planning').doc(mois).get()
    if (!planSnap.exists) {
      return NextResponse.json({ success: false, error: `Planning ${mois} introuvable` }, { status: 404 })
    }
    const slots: Record<string, string> = planSnap.data()?.slots || {}

    let created = 0
    let skipped = 0
    const details: string[] = []

    for (const [key, vendeuseId] of Object.entries(slots)) {
      const [dateStr, creneau] = key.split('_')
      if (!dateStr || !creneau) continue
      if (dateStr < fromDate || dateStr > toDate) continue

      const [startH, endH] = creneau.split('-').map(Number)
      if (!Number.isFinite(startH) || !Number.isFinite(endH)) continue

      const docId = `${dateStr}_${vendeuseId}`
      const ref = adminDb.collection('pointages').doc(docId)
      const existing = await ref.get()
      if (existing.exists) {
        skipped++
        continue
      }

      const arrivee = new Date(parisISO(dateStr, startH))
      const depart = new Date(parisISO(dateStr, endH))

      await ref.set({
        vendeuseId,
        date: dateStr,
        arrivee: Timestamp.fromDate(arrivee),
        depart: Timestamp.fromDate(depart),
        createdAt: Timestamp.now(),
      })
      created++
      details.push(`${dateStr} ${creneau} → ${vendeuseId}`)
    }

    return NextResponse.json({ success: true, created, skipped, details })
  } catch (err: any) {
    console.error('[API POINTAGE BACKFILL]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}
