// app/api/tiktok/creator-info/route.ts
// Infos du compte TikTok connecté (pseudo, confidentialités autorisées, options
// commentaires/duo/montage). Obligatoire avant un Direct Post : TikTok exige que
// ces réglages soient présentés à l'utilisateur avant publication.

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { canDirectPost, getTikTokCreatorInfo } from '@/lib/tiktokPublish'

export async function GET() {
  try {
    const direct = await canDirectPost()
    if (!direct) return NextResponse.json({ success: true, direct: false })
    const info = await getTikTokCreatorInfo()
    return NextResponse.json({ success: true, direct: true, info })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
