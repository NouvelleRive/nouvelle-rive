// app/api/deposante/rdv-decision/route.ts
// Vendeuse / admin accepte ou refuse un RDV de déposante.
// Sur acceptation → email "Nous attendons votre dépôt".
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const STAFF_EMAILS = new Set([
  'nouvelleriveparis@gmail.com',
  'nouvellerivecommandes@gmail.com',
])

function frenchDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    let decoded
    try { decoded = await adminAuth.verifyIdToken(token) } catch {
      return NextResponse.json({ success: false, error: 'Token invalide' }, { status: 401 })
    }
    if (!decoded.email || !STAFF_EMAILS.has(decoded.email)) {
      return NextResponse.json({ success: false, error: 'Réservé au staff' }, { status: 403 })
    }

    const body = await req.json()
    const { monthKey, slotKey, decision, raison } = body as { monthKey: string; slotKey: string; decision: 'accepter' | 'refuser'; raison?: string }
    if (!monthKey || !slotKey || !['accepter', 'refuser'].includes(decision)) {
      return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })
    }

    const ref = adminDb.collection('restocks').doc(monthKey)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ success: false, error: 'Mois introuvable' }, { status: 404 })

    const data = snap.data() as any
    const slots = data.slots || {}
    const slot = slots[slotKey]
    if (!slot) return NextResponse.json({ success: false, error: 'Créneau introuvable' }, { status: 404 })
    if (slot.type !== 'deposante') return NextResponse.json({ success: false, error: 'Pas un RDV déposante' }, { status: 400 })

    if (decision === 'accepter') {
      slot.acceptee = true
      slot.accepteeAt = Timestamp.now()
      slot.accepteePar = decoded.email
      delete slot.refusee
      delete slot.refuseeAt
      delete slot.refuseePar
    } else {
      // Refus → on supprime le créneau pour libérer la place + on note la raison sur le doc déposante
      delete slots[slotKey]
    }
    slots[slotKey] = decision === 'accepter' ? slot : undefined
    if (decision === 'refuser') delete slots[slotKey]

    await ref.update({ slots })

    // Email à la déposante
    if (slot.trigramme) {
      const depSnap = await adminDb.collection('deposante').where('trigramme', '==', slot.trigramme).limit(1).get()
      if (!depSnap.empty) {
        const dep = depSnap.docs[0].data() as any
        const [dateStr, creneau] = slotKey.split('_')
        const jour = frenchDate(dateStr)
        if (decision === 'accepter' && dep.email) {
          try {
            await resend.emails.send({
              from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
              to: dep.email,
              bcc: 'nouvelleriveparis@gmail.com',
              subject: `Rendez-vous confirmé — ${jour} à ${creneau} 💙`,
              html: `
                <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
                  <h1 style="color:#22209C;">Rendez-vous confirmé 💙</h1>
                  <p>Bonjour ${dep.prenom || ''},</p>
                  <p>Nous vous attendons en boutique pour votre dépôt :</p>
                  <p style="font-size:18px;font-weight:bold;">${jour}<br/>à <span style="color:#22209C;">${creneau}</span></p>
                  <p>Adresse : <strong>8 rue des Écouffes, 75004 Paris</strong></p>
                  <p style="margin-top:24px;">Pensez à apporter les pièces sélectionnées dans votre espace.</p>
                  <p style="font-size:12px;color:#888;margin-top:32px;">À très bientôt.</p>
                </div>
              `,
            })
          } catch (e: any) {
            console.error('Email RDV accepté échoué:', e?.message)
          }
        } else if (decision === 'refuser' && dep.email) {
          try {
            await resend.emails.send({
              from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
              to: dep.email,
              bcc: 'nouvelleriveparis@gmail.com',
              subject: `Rendez-vous non retenu`,
              html: `
                <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
                  <p>Bonjour ${dep.prenom || ''},</p>
                  <p>Nous ne pouvons pas retenir votre rendez-vous du <strong>${jour} à ${creneau}</strong>.</p>
                  ${raison ? `<p>Raison : ${raison}</p>` : ''}
                  <p>Vous pouvez en reprendre un nouveau via votre espace :
                    <a href="https://www.nouvellerive.eu/deposante/calendrier">Prendre RDV</a>
                  </p>
                </div>
              `,
            })
          } catch (e: any) {
            console.error('Email RDV refusé échoué:', e?.message)
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[deposante/rdv-decision]', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
