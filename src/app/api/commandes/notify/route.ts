// app/api/commandes/notify/route.ts
// Envoie au CLIENT l'email d'expédition ("Postée") ou de retrait prêt ("Préparée"
// en boutique). Appelée par CommandesPanel après la mise à jour Firestore.
// Idempotent : un flag sur le doc commande empêche tout renvoi.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebaseAdmin'
import { sendConfirmationEnvoi, sendRetraitPret, type ArticleCommande } from '@/lib/emails/commandes'

export async function POST(req: NextRequest) {
  try {
    const { commandeId, type } = await req.json() as { commandeId?: string; type?: 'envoi' | 'retrait' }
    if (!commandeId || (type !== 'envoi' && type !== 'retrait')) {
      return NextResponse.json({ success: false, error: 'params invalides' }, { status: 400 })
    }

    const ref = adminDb.collection('commandes').doc(commandeId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'commande introuvable' }, { status: 404 })
    }
    const c = snap.data()!

    const email = c.client?.email
    if (!email) {
      return NextResponse.json({ success: false, error: 'email client manquant' }, { status: 400 })
    }

    const flag = type === 'envoi' ? 'confirmEnvoiSentAt' : 'retraitPretSentAt'
    if (c[flag]) {
      return NextResponse.json({ success: true, skipped: 'déjà envoyé' })
    }

    const articles: ArticleCommande[] = [{
      nom: c.productName,
      sku: c.productSku,
      marque: c.productMarque,
      prix: c.prix,
      image: c.productImage,
    }]
    const prenom = c.client?.prenom || ''

    let res
    if (type === 'envoi') {
      if (!c.numeroSuivi) {
        return NextResponse.json({ success: false, error: 'numéro de suivi manquant' }, { status: 400 })
      }
      res = await sendConfirmationEnvoi({ email, prenom, articles, numeroSuivi: c.numeroSuivi, transporteur: c.transporteur })
    } else {
      res = await sendRetraitPret({ email, prenom, articles })
    }

    if (!res.success) {
      return NextResponse.json({ success: false, error: 'envoi email échoué' }, { status: 500 })
    }

    await ref.update({ [flag]: Timestamp.now() })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ /api/commandes/notify KO:', error?.message)
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 })
  }
}
