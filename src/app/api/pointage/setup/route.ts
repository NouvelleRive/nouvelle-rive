export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const expected = process.env.BOUTIQUE_DEVICE_TOKEN
  if (!expected) {
    return NextResponse.json({ success: false, error: 'BOUTIQUE_DEVICE_TOKEN non configuré' }, { status: 500 })
  }
  if (!token || token !== expected) {
    return NextResponse.json({ success: false, error: 'Token invalide' }, { status: 403 })
  }
  const res = NextResponse.json({ success: true })
  res.cookies.set('nr_boutique', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365 * 2,
  })
  return res
}
