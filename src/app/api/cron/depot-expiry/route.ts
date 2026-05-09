// app/api/cron/depot-expiry/route.ts
// Cron quotidien — règle Article 4 du contrat dépôt-vente :
//
//   J+30 après réception en boutique : email déposante (7 jours pour venir récupérer).
//   J+37 (= notif + 7j) si toujours invendu et non récupéré : -20% auto sur le prix.
//
// `dryRun=1` en query → simulation sans envoi d'email ni écriture Firestore.

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import { adminDb } from '@/lib/firebaseAdmin'

const CRON_SECRET = process.env.CRON_SECRET
const resend = new Resend(process.env.RESEND_API_KEY)

const MS_PER_DAY = 86_400_000
const J_NOTIF = 30
const J_BAISSE = 7 // jours après notif pour appliquer -20%
const POURCENT_BAISSE = 0.20

type Produit = {
  id: string
  nom?: string
  sku?: string
  prix?: number
  trigramme?: string
  dateReception?: Timestamp
  notifJ30SentAt?: Timestamp
  baisse20Done?: boolean
  ancienPrix?: number
}

function daysAgo(ts?: Timestamp): number {
  if (!ts) return 0
  return (Date.now() - ts.toMillis()) / MS_PER_DAY
}

function buildEmailHtml(prenom: string, items: Produit[]) {
  const rows = items.map(p => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${p.nom || p.sku || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${(p.prix || 0).toFixed(2)} €</td>
    </tr>`).join('')

  return `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#000;">
      <h1 style="color:#22209C;font-size:20px;margin-bottom:8px;">Vos articles ont 30 jours en boutique</h1>
      <p>Bonjour ${prenom || ''},</p>
      <p>Vos articles ci-dessous sont déposés depuis 30 jours et n'ont pas encore trouvé preneur :</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>
      <p>Conformément à l'<strong>article 4 du contrat de dépôt-vente</strong>, vous disposez de <strong>7 jours</strong> pour venir les récupérer en boutique. Passé ce délai, leur prix de vente sera <strong>automatiquement réduit de 20 %</strong> pour favoriser leur vente.</p>

      <h2 style="color:#22209C;font-size:16px;margin-top:24px;">Comment récupérer vos pièces ?</h2>
      <ol style="padding-left:20px;line-height:1.6;">
        <li>Dans <a href="https://www.nouvellerive.eu/deposante/mes-produits" style="color:#22209C;">Mes produits</a>, cliquez sur l'icône <strong>corbeille</strong> 🗑️ de chaque pièce que vous souhaitez récupérer, puis sélectionnez <em>« Produit récupéré »</em>.</li>
        <li>Prenez <strong>rendez-vous</strong> en boutique via votre <a href="https://www.nouvellerive.eu/deposante/calendrier" style="color:#22209C;">calendrier</a> — vous pouvez en profiter pour déposer de nouvelles pièces si vous le souhaitez.</li>
      </ol>

      <p style="margin-top:24px;">
        <a href="https://www.nouvellerive.eu/deposante/mes-produits" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;margin-right:8px;margin-bottom:8px;">Mes produits</a>
        <a href="https://www.nouvellerive.eu/deposante/calendrier" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;margin-bottom:8px;">Prendre RDV</a>
      </p>
      <p style="font-size:12px;color:#888;margin-top:32px;">Une question ? nouvelleriveparis@gmail.com</p>
    </div>
  `
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  const now = new Date()

  const snap = await adminDb
    .collection('produits')
    .where('source', '==', 'deposante')
    .where('vendu', '==', false)
    .where('recu', '==', true)
    .get()

  const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Produit[]

  // Regroupe par trigramme pour 1 email par déposante.
  const aNotifier: Record<string, Produit[]> = {}
  const aBaisser: Produit[] = []

  for (const p of all) {
    const ageJours = daysAgo(p.dateReception)
    if (ageJours < J_NOTIF) continue

    if (!p.notifJ30SentAt) {
      const tri = p.trigramme || '_unknown_'
      if (!aNotifier[tri]) aNotifier[tri] = []
      aNotifier[tri].push(p)
    } else if (!p.baisse20Done && daysAgo(p.notifJ30SentAt) >= J_BAISSE) {
      aBaisser.push(p)
    }
  }

  const emailsEnvoyes: { trigramme: string; email: string; nbItems: number }[] = []
  const emailsErreurs: { trigramme: string; error: string }[] = []
  const baissesAppliquees: { id: string; sku?: string; prixAvant: number; prixApres: number }[] = []

  // 1) Notifications J+30
  for (const [trigramme, items] of Object.entries(aNotifier)) {
    try {
      const depSnap = await adminDb.collection('deposante').where('trigramme', '==', trigramme).limit(1).get()
      if (depSnap.empty) {
        emailsErreurs.push({ trigramme, error: 'deposante introuvable' })
        continue
      }
      const dep = depSnap.docs[0].data()
      const email = dep.email
      const prenom = dep.prenom || ''
      if (!email) {
        emailsErreurs.push({ trigramme, error: 'email manquant' })
        continue
      }

      if (!dryRun) {
        await resend.emails.send({
          from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
          to: email,
          bcc: 'nouvelleriveparis@gmail.com',
          subject: 'Vos articles ont 30 jours en boutique',
          html: buildEmailHtml(prenom, items),
        })
        const batch = adminDb.batch()
        for (const p of items) {
          batch.update(adminDb.collection('produits').doc(p.id), {
            notifJ30SentAt: Timestamp.now(),
          })
        }
        await batch.commit()
      }
      emailsEnvoyes.push({ trigramme, email, nbItems: items.length })
    } catch (e: any) {
      emailsErreurs.push({ trigramme, error: e?.message || 'erreur inconnue' })
    }
  }

  // 2) Baisse -20% à J+37
  for (const p of aBaisser) {
    const prixAvant = p.prix || 0
    if (prixAvant <= 0) continue
    const prixApres = Math.round(prixAvant * (1 - POURCENT_BAISSE) * 100) / 100
    if (!dryRun) {
      await adminDb.collection('produits').doc(p.id).update({
        prix: prixApres,
        ancienPrix: prixAvant,
        prixBaisseLe: Timestamp.now(),
        baisse20Done: true,
      })
    }
    baissesAppliquees.push({ id: p.id, sku: p.sku, prixAvant, prixApres })
  }

  return NextResponse.json({
    success: true,
    dryRun,
    parisDate: now.toISOString(),
    nbProduitsScannes: all.length,
    emailsEnvoyes,
    emailsErreurs,
    baissesAppliquees,
  })
}
