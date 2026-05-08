// app/api/deposante/valider/route.ts
// Vendeuse / admin valide ou refuse une déposante (one-shot, après contrat signé).
// Envoie un email à la déposante en cas de validation.
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
    const { uid, decision, raison } = body as { uid: string; decision: 'valider' | 'refuser'; raison?: string }
    if (!uid || !['valider', 'refuser'].includes(decision)) {
      return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })
    }

    const ref = adminDb.collection('deposante').doc(uid)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ success: false, error: 'Déposante introuvable' }, { status: 404 })
    const data = snap.data() as any

    if (decision === 'valider') {
      await ref.update({
        validee: true,
        valideeAt: Timestamp.now(),
        valideePar: decoded.email,
        refusee: false,
      })
      // Email confirmation
      if (data.email) {
        try {
          await resend.emails.send({
            from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
            to: data.email,
            bcc: 'nouvelleriveparis@gmail.com',
            subject: 'Votre profil a été validé 💙',
            html: `
              <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
                <h1 style="color:#22209C;">Bienvenue chez Nouvelle Rive 💙</h1>
                <p>Bonjour ${data.prenom || ''},</p>
                <p>Votre profil de déposante a été validé par notre équipe.</p>
                <p>Vous pouvez maintenant <strong>déposer vos pièces</strong> via votre espace, puis prendre rendez-vous pour les apporter en boutique.</p>
                <p style="margin-top:24px;">
                  <a href="https://www.nouvellerive.eu/deposante/formulaire" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Déposer mes pièces</a>
                </p>
                <p style="font-size:12px;color:#888;margin-top:32px;">À bientôt en boutique au 8 rue des Écouffes, 75004 Paris.</p>
              </div>
            `,
          })
        } catch (e: any) {
          console.error('Email validation déposante échoué:', e?.message)
        }
      }
    } else {
      await ref.update({
        validee: false,
        refusee: true,
        refuseeAt: Timestamp.now(),
        refuseeRaison: raison || '',
        refuseePar: decoded.email,
      })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[deposante/valider]', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
