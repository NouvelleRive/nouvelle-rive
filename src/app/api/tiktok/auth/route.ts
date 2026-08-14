// app/api/tiktok/auth/route.ts
// Démarre l'OAuth TikTok : redirige vers la page d'autorisation.
// (Login Kit + Content Posting API). Le token revient sur /api/tiktok/callback.

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY
const REDIRECT_URI = 'https://www.nouvellerive.eu/api/tiktok/callback'
const SCOPES = 'user.info.basic,video.upload,video.publish'

export async function GET() {
  if (!CLIENT_KEY) {
    return NextResponse.json({ error: 'TIKTOK_CLIENT_KEY manquant (à mettre dans Vercel)' }, { status: 500 })
  }
  // state anti-CSRF stocké en cookie, vérifié au callback
  const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/')
  url.searchParams.set('client_key', CLIENT_KEY)
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('tiktok_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })
  return res
}
