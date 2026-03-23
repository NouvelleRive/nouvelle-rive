export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminStorage } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'Non authentifiée' }, { status: 401 })

    let decoded
    try { decoded = await adminAuth.verifyIdToken(token) } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') || 'application/octet-stream'
    const ext = contentType.includes('pdf') ? 'pdf' : 'jpg'
    const path = `pieces-identite/${decoded.uid}.${ext}`

    const body = await req.arrayBuffer()
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET
    console.log('BUCKET:', bucketName)
    const bucket = adminStorage.bucket(bucketName)
    const file = bucket.file(path)

    await file.save(Buffer.from(body), {
      metadata: { contentType },
      private: true,
    })

    // URL signée valable 10 ans
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    })

    return NextResponse.json({ url: signedUrl })

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}