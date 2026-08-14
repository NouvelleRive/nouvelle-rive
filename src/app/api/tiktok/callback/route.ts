// app/api/tiktok/callback/route.ts
// Reçoit le code OAuth TikTok, l'échange contre un access/refresh token,
// et le stocke dans Firestore (reseauxConfig/tiktok). Redirige vers l'app.

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET
const REDIRECT_URI = 'https://www.nouvellerive.eu/api/tiktok/callback'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const code = params.get('code')
  const state = params.get('state')
  const err = params.get('error')
  const cookieState = req.cookies.get('tiktok_oauth_state')?.value

  const back = (q: string) => NextResponse.redirect(`https://www.nouvellerive.eu/vendeuse/reseaux?tiktok=${q}`)

  if (err) return back('refuse')
  if (!code) return back('no_code')
  if (!state || !cookieState || state !== cookieState) return back('bad_state')
  if (!CLIENT_KEY || !CLIENT_SECRET) return back('config')

  try {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    })
    const data = await res.json()
    if (!data.access_token) {
      console.error('tiktok token error', data)
      return back('token_error')
    }
    await adminDb.collection('reseauxConfig').doc('tiktok').set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      openId: data.open_id,
      scope: data.scope,
      expiresAt: Date.now() + (data.expires_in || 0) * 1000,
      refreshExpiresAt: Date.now() + (data.refresh_expires_in || 0) * 1000,
      updatedAt: Date.now(),
    }, { merge: true })
    return back('ok')
  } catch (e: any) {
    console.error('tiktok callback failed', e)
    return back('error')
  }
}
