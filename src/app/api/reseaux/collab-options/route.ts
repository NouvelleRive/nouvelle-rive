import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

// Suggestions de comptes à inviter en collab : les chineuses/créatrices ayant un IG.
// Server-side (adminDb), mis en cache 1h — gratuit.

function cleanHandle(ig: string): string {
  return ig.trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[?#/].*$/, '') // retire ?igsh=…, #… ou /… en fin
    .trim()
}

export async function GET() {
  try {
    const snap = await adminDb.collection('chineuse').get()
    const options = snap.docs
      .map((d) => {
        const x = d.data() as any
        const handle = cleanHandle(x.instagram || '')
        const nom = [x.prenom, x.nom].filter(Boolean).join(' ') || x.nom || handle
        return handle ? { nom, handle } : null
      })
      .filter(Boolean)
      // dédoublonne par handle
      .filter((o, i, arr) => arr.findIndex((y) => y!.handle === o!.handle) === i)
      .sort((a, b) => a!.nom.localeCompare(b!.nom))

    return NextResponse.json(
      { success: true, options },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
