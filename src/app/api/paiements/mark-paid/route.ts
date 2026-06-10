export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  try {
    const { mois, items } = await req.json() as {
      mois: string
      items: { chineuseId: string; montant: number }[]
    }
    if (!mois || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })
    }
    const now = Timestamp.now()
    const batch = adminDb.batch()
    for (const it of items) {
      const ref = adminDb.collection('paiements').doc(mois).collection('statuts').doc(it.chineuseId)
      batch.set(ref, {
        factureRecue: true,
        paye: true,
        datePaiement: now,
        montant: it.montant,
      }, { merge: true })
    }
    await batch.commit()
    return NextResponse.json({ success: true, count: items.length })
  } catch (e: any) {
    console.error('[mark-paid]', e)
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 })
  }
}
