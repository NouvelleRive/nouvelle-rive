// app/api/pointage/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { isAtBoutique, pointageDocId } from '@/lib/pointage'

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

// GET ?vendeuseId=...&date=YYYY-MM-DD → statut du jour pour une vendeuse
// GET ?date=YYYY-MM-DD → statuts du jour pour TOUTES les vendeuses
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const vendeuseId = searchParams.get('vendeuseId')
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const mois = searchParams.get('mois') // YYYY-MM pour vue admin mensuelle

    if (mois) {
      const snap = await adminDb
        .collection('pointages')
        .where('date', '>=', `${mois}-01`)
        .where('date', '<=', `${mois}-31`)
        .get()
      const items = snap.docs.map(d => {
        const x = d.data()
        return {
          id: d.id,
          vendeuseId: x.vendeuseId,
          date: x.date,
          arrivee: x.arrivee?.toDate?.()?.toISOString?.() || null,
          depart: x.depart?.toDate?.()?.toISOString?.() || null,
        }
      })
      return NextResponse.json({ success: true, items })
    }

    if (vendeuseId) {
      const id = pointageDocId(new Date(dateStr), vendeuseId)
      const snap = await adminDb.collection('pointages').doc(id).get()
      if (!snap.exists) {
        return NextResponse.json({ success: true, pointage: null })
      }
      const x = snap.data()!
      return NextResponse.json({
        success: true,
        pointage: {
          vendeuseId: x.vendeuseId,
          date: x.date,
          arrivee: x.arrivee?.toDate?.()?.toISOString?.() || null,
          depart: x.depart?.toDate?.()?.toISOString?.() || null,
        },
      })
    }

    return NextResponse.json({ success: false, error: 'vendeuseId ou mois requis' }, { status: 400 })
  } catch (err: any) {
    console.error('[API POINTAGE GET]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

// POST { vendeuseId, action: 'arrivee' | 'depart', lat, lng }
export async function POST(req: NextRequest) {
  try {
    const { vendeuseId, action, lat, lng } = await req.json()
    if (!vendeuseId || !action) {
      return NextResponse.json({ success: false, error: 'vendeuseId et action requis' }, { status: 400 })
    }
    if (action !== 'arrivee' && action !== 'depart') {
      return NextResponse.json({ success: false, error: 'action invalide' }, { status: 400 })
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ success: false, error: 'coordonnées GPS requises' }, { status: 400 })
    }
    if (!isAtBoutique(lat, lng)) {
      return NextResponse.json(
        { success: false, error: 'Tu n\'es pas à la boutique. Réessaie depuis le 8 rue des Écouffes.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const id = pointageDocId(now, vendeuseId)
    const ref = adminDb.collection('pointages').doc(id)
    const snap = await ref.get()
    const existing = snap.exists ? snap.data()! : null

    if (action === 'arrivee') {
      if (existing?.arrivee) {
        return NextResponse.json({ success: false, error: 'Tu as déjà pointé ton arrivée aujourd\'hui.' }, { status: 400 })
      }
      await ref.set({
        vendeuseId,
        date: dateStr,
        arrivee: Timestamp.fromDate(now),
        arriveeGps: { lat, lng },
        createdAt: existing?.createdAt || Timestamp.fromDate(now),
      }, { merge: true })
      // Détecte les pointages passés sans départ pour rappel à la vendeuse
      const pastSnap = await adminDb.collection('pointages').where('vendeuseId', '==', vendeuseId).get()
      const missingDeparts = pastSnap.docs
        .map(d => d.data())
        .filter(x => x.date < dateStr && x.arrivee && !x.depart)
        .map(x => x.date)
        .sort()
      return NextResponse.json({ success: true, action: 'arrivee', at: now.toISOString(), missingDeparts })
    }

    // action === 'depart'
    if (!existing?.arrivee) {
      return NextResponse.json({ success: false, error: 'Tu n\'as pas pointé ton arrivée aujourd\'hui.' }, { status: 400 })
    }
    if (existing.depart) {
      return NextResponse.json({ success: false, error: 'Tu as déjà pointé ton départ aujourd\'hui.' }, { status: 400 })
    }
    await ref.update({
      depart: Timestamp.fromDate(now),
      departGps: { lat, lng },
    })
    return NextResponse.json({ success: true, action: 'depart', at: now.toISOString() })
  } catch (err: any) {
    console.error('[API POINTAGE POST]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

// PATCH (admin) — corriger un pointage
export async function PATCH(req: NextRequest) {
  try {
    if (!await isAdmin(req)) {
      return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 403 })
    }
    const { id, arrivee, depart } = await req.json()
    if (!id) return NextResponse.json({ success: false, error: 'id requis' }, { status: 400 })
    const update: any = {}
    if (arrivee === null) update.arrivee = FieldValue.delete()
    else if (arrivee) update.arrivee = Timestamp.fromDate(new Date(arrivee))
    if (depart === null) update.depart = FieldValue.delete()
    else if (depart) update.depart = Timestamp.fromDate(new Date(depart))
    await adminDb.collection('pointages').doc(id).set(update, { merge: true })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API POINTAGE PATCH]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}
