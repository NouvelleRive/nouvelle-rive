// app/api/notif/annonce-restock/route.ts
// POST { dateStr, creneau, nom, type } → push à l'admin (owner 'boutique')
// quand une chineuse réserve un slot de restock dans le calendrier.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { sendPushToOwner } from '@/lib/webpush'

function frenchDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export async function POST(req: NextRequest) {
  try {
    const { dateStr, creneau, nom, type } = await req.json()
    if (!dateStr || !creneau || !nom) {
      return NextResponse.json({ success: false, error: 'dateStr, creneau, nom requis' }, { status: 400 })
    }
    const jour = frenchDate(dateStr)
    const label = type === 'chineuse' ? 'Annonce restock chineuse' : type === 'deposante' ? 'Annonce restock déposante' : 'Annonce restock'
    await sendPushToOwner('boutique', {
      title: `📦 ${label} — ${nom}`,
      body: `${jour} à ${creneau}`,
      url: '/admin/selectionneuses',
      tag: `annonce-restock-${dateStr}-${creneau}-${nom}`,
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API annonce-restock]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}
