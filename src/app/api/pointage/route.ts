// app/api/pointage/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { pointageDocId } from '@/lib/pointage'
import { sendPushToOwner } from '@/lib/webpush'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'
const VENDEUSE_EMAIL = 'nouvellerivecommandes@gmail.com'
const BOUTIQUE_EMAILS = new Set([ADMIN_EMAIL, VENDEUSE_EMAIL])

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

async function isBoutiqueAccount(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return false
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return !!decoded?.email && BOUTIQUE_EMAILS.has(decoded.email)
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

// POST { vendeuseId, action: 'arrivee' | 'depart' } — cookie `nr_boutique` requis
export async function POST(req: NextRequest) {
  try {
    const { vendeuseId, action } = await req.json()
    if (!vendeuseId || !action) {
      return NextResponse.json({ success: false, error: 'vendeuseId et action requis' }, { status: 400 })
    }
    if (action !== 'arrivee' && action !== 'depart') {
      return NextResponse.json({ success: false, error: 'action invalide' }, { status: 400 })
    }
    const expectedToken = process.env.BOUTIQUE_DEVICE_TOKEN
    if (!expectedToken) {
      return NextResponse.json({ success: false, error: 'BOUTIQUE_DEVICE_TOKEN non configuré' }, { status: 500 })
    }
    const cookieToken = req.cookies.get('nr_boutique')?.value
    const headerToken = req.headers.get('x-boutique-token') || undefined
    const boutiqueToken = cookieToken || headerToken
    const tokenOk = boutiqueToken === expectedToken
    const accountOk = !tokenOk && await isBoutiqueAccount(req)
    if (!tokenOk && !accountOk) {
      return NextResponse.json(
        { success: false, error: 'Tu dois pointer depuis le téléphone de la boutique 💙' },
        { status: 403 }
      )
    }

    const withBoutiqueCookie = (data: any, init?: ResponseInit) => {
      const res = NextResponse.json(data, init)
      res.cookies.set('nr_boutique', expectedToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365 * 2,
      })
      return res
    }

    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const id = pointageDocId(now, vendeuseId)
    const ref = adminDb.collection('pointages').doc(id)
    const snap = await ref.get()
    const existing = snap.exists ? snap.data()! : null

    // Lookup prénom de la vendeuse pour la notif admin (best-effort)
    let prenom = vendeuseId
    try {
      const vSnap = await adminDb.collection('vendeuses').doc(vendeuseId).get()
      if (vSnap.exists) prenom = vSnap.data()?.prenom || vendeuseId
    } catch {}
    const heureFR = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

    if (action === 'arrivee') {
      if (existing?.arrivee) {
        return withBoutiqueCookie({ success: false, error: 'Tu as déjà pointé ton arrivée aujourd\'hui.' }, { status: 400 })
      }
      await ref.set({
        vendeuseId,
        date: dateStr,
        arrivee: Timestamp.fromDate(now),
        createdAt: existing?.createdAt || Timestamp.fromDate(now),
      }, { merge: true })
      // Notif admin (best-effort, n'interrompt jamais le flow)
      try {
        await sendPushToOwner('boutique', {
          title: `🟢 ${prenom} arrivée ${heureFR}`,
          body: 'Pointage arrivée enregistré',
          url: '/admin/vendeuses',
          tag: `pointage-${dateStr}-${vendeuseId}-arrivee`,
        })
      } catch (e) { console.warn('Push pointage arrivée failed:', e) }
      // Détecte les pointages passés sans départ pour rappel à la vendeuse
      const pastSnap = await adminDb.collection('pointages').where('vendeuseId', '==', vendeuseId).get()
      const missingDeparts = pastSnap.docs
        .map(d => d.data())
        .filter(x => x.date < dateStr && x.arrivee && !x.depart)
        .map(x => x.date)
        .sort()
      return withBoutiqueCookie({ success: true, action: 'arrivee', at: now.toISOString(), missingDeparts })
    }

    // action === 'depart'
    if (!existing?.arrivee) {
      return withBoutiqueCookie({ success: false, error: 'Tu n\'as pas pointé ton arrivée aujourd\'hui.' }, { status: 400 })
    }
    if (existing.depart) {
      return withBoutiqueCookie({ success: false, error: 'Tu as déjà pointé ton départ aujourd\'hui.' }, { status: 400 })
    }
    await ref.update({
      depart: Timestamp.fromDate(now),
    })
    try {
      await sendPushToOwner('boutique', {
        title: `🔴 ${prenom} partie ${heureFR}`,
        body: 'Pointage départ enregistré',
        url: '/admin/vendeuses',
        tag: `pointage-${dateStr}-${vendeuseId}-depart`,
      })
    } catch (e) { console.warn('Push pointage départ failed:', e) }
    return withBoutiqueCookie({ success: true, action: 'depart', at: now.toISOString() })
  } catch (err: any) {
    console.error('[API POINTAGE POST]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

// DELETE (admin) — supprimer un pointage
export async function DELETE(req: NextRequest) {
  try {
    if (!await isAdmin(req)) {
      return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'id requis' }, { status: 400 })
    await adminDb.collection('pointages').doc(id).delete()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API POINTAGE DELETE]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

// PATCH (admin) — corriger un pointage
export async function PATCH(req: NextRequest) {
  try {
    if (!await isAdmin(req)) {
      return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 403 })
    }
    const { id, arrivee, depart, vendeuseId, date } = await req.json()
    if (!id) return NextResponse.json({ success: false, error: 'id requis' }, { status: 400 })
    const update: any = {}
    if (vendeuseId) update.vendeuseId = vendeuseId
    if (date) update.date = date
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
