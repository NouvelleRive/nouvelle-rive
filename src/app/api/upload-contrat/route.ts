export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminStorage, adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'Non authentifiée' }, { status: 401 })

    let decoded
    try { decoded = await adminAuth.verifyIdToken(token) } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const path = `contrats-deposante/${decoded.uid}_${stamp}.pdf`

    const body = await req.arrayBuffer()
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET
    const bucket = adminStorage.bucket(bucketName)
    const file = bucket.file(path)

    await file.save(Buffer.from(body), {
      metadata: { contentType: 'application/pdf' },
      private: true,
    })

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    })

    const depSnap = await adminDb.collection('deposante').where('authUid', '==', decoded.uid).limit(1).get()
    if (!depSnap.empty) {
      await depSnap.docs[0].ref.update({
        contratSigne: true,
        contratUrl: signedUrl,
        contratPath: path,
        contratSigneAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    }

    return NextResponse.json({ url: signedUrl, path })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}
