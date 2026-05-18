// app/api/deposante/rdv-demande/route.ts
// Déposante vient de poser un RDV → email de confirmation de réception
// (le RDV n'est PAS encore confirmé, il sera revu par l'équipe).
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { Resend } from 'resend'
import { sendPushToOwner } from '@/lib/webpush'

const resend = new Resend(process.env.RESEND_API_KEY)

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
    const uid = decoded.uid

    const body = await req.json()
    const { monthKey, slotKey } = body as { monthKey: string; slotKey: string }
    if (!monthKey || !slotKey) {
      return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })
    }

    // Récupère la déposante (doc id == uid, sinon fallback authUid)
    let depDoc = await adminDb.collection('deposante').doc(uid).get()
    if (!depDoc.exists) {
      const fb = await adminDb.collection('deposante').where('authUid', '==', uid).limit(1).get()
      if (fb.empty) return NextResponse.json({ success: false, error: 'Déposante introuvable' }, { status: 404 })
      depDoc = fb.docs[0]
    }
    const dep = depDoc.data() as any
    if (!dep?.email) return NextResponse.json({ success: true, skipped: 'no-email' })

    // Vérifie le slot
    const ref = adminDb.collection('restocks').doc(monthKey)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ success: false, error: 'Mois introuvable' }, { status: 404 })
    const slot = (snap.data()?.slots || {})[slotKey]
    if (!slot) return NextResponse.json({ success: false, error: 'Créneau introuvable' }, { status: 404 })
    if (slot.type !== 'deposante' || slot.trigramme !== dep.trigramme) {
      return NextResponse.json({ success: false, error: 'Slot non rattaché à cette déposante' }, { status: 403 })
    }

    const [dateStr, creneau] = slotKey.split('_')
    const jour = frenchDate(dateStr)

    // Liste des pièces avec photos
    let piecesHtml = ''
    if (slot.pieceIds && slot.pieceIds.length > 0) {
      const piecesData: any[] = []
      for (const id of slot.pieceIds) {
        try {
          const ps = await adminDb.collection('produits').doc(id).get()
          if (ps.exists) piecesData.push({ id: ps.id, ...(ps.data() as any) })
        } catch {}
      }
      if (piecesData.length) {
        const rows = piecesData.map(p => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;width:80px;">
              ${p.imageUrl ? `<img src="${p.imageUrl}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:4px;display:block;" />` : ''}
            </td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;">
              <strong>${p.sku || ''}</strong> ${(p.nom || '').replace(`${p.sku} - `, '')}<br/>
              <span style="color:#888;font-size:11px;">${(p.categorie || '').replace('DEP - ', '')} · ${p.prix || ''}€</span>
            </td>
          </tr>`).join('')
        piecesHtml = `
          <p style="margin-top:24px;font-weight:600;">Pièces proposées :</p>
          <table style="width:100%;border-collapse:collapse;margin-top:8px;">${rows}</table>`
      }
    }

    try {
      await resend.emails.send({
        from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
        to: dep.email,
        bcc: 'nouvelleriveparis@gmail.com',
        subject: `Demande de rendez-vous reçue 💙 — ${jour} à ${creneau}`,
        html: `
          <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
            <h1 style="color:#22209C;">Demande de rendez-vous reçue 💙</h1>
            <p>Bonjour ${dep.prenom || ''},</p>
            <p>Nous avons bien reçu votre demande de rendez-vous pour le <strong>${jour}</strong> à <strong>${creneau}</strong>.</p>
            <p><strong>Votre rendez-vous sera confirmé après revue du dépôt par notre équipe.</strong> Vous recevrez un email de confirmation dès que c'est validé.</p>
            ${piecesHtml}
            <p style="font-size:12px;color:#888;margin-top:32px;">À très bientôt 🌊</p>
          </div>
        `,
      })
    } catch (e: any) {
      console.error('Email demande RDV échoué:', e?.message)
      return NextResponse.json({ success: false, error: 'Email non envoyé' }, { status: 500 })
    }

    // Push notif admin (best-effort)
    try {
      const nbPieces = (slot.pieceIds || []).length
      await sendPushToOwner('boutique', {
        title: `📦 RDV restock demandé — ${dep.prenom || dep.trigramme || 'déposante'}`,
        body: `${jour} à ${creneau}${nbPieces ? ` · ${nbPieces} pièce${nbPieces > 1 ? 's' : ''}` : ''}`,
        url: '/admin/selectionneuses',
        tag: `rdv-${monthKey}-${slotKey}`,
      })
    } catch (e) { console.warn('Push RDV restock failed:', e) }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[deposante/rdv-demande]', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
