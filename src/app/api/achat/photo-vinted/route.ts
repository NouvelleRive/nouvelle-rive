// app/api/achat/photo-vinted/route.ts
// Récupère la 1re photo d'une annonce Vinted (balise og:image de la page
// publique), la ré-héberge sur Bunny, et la pose sur la pièce (photos.details
// + imageUrls pour l'affichage). Auth : acheteuse ou admin.
export const runtime = 'nodejs'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { ADMIN_EMAIL, ACHETEUSE_EMAIL } from '@/lib/roles'

const ALLOWED = new Set([ADMIN_EMAIL, ACHETEUSE_EMAIL])
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

async function authEmail(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const email = (decoded.email || '').toLowerCase()
    return ALLOWED.has(email) ? email : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const email = await authEmail(req)
  if (!email) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

  let productId = '', url = ''
  try {
    const json = await req.json()
    productId = String(json?.productId || '')
    url = String(json?.url || '').trim()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 })
  }
  if (!productId) return NextResponse.json({ success: false, error: 'productId requis' }, { status: 400 })
  if (!/^https?:\/\/(www\.)?vinted\.[a-z.]+\/items\//i.test(url)) {
    return NextResponse.json({ success: false, error: 'URL Vinted d\'annonce (/items/…) requise' }, { status: 400 })
  }

  try {
    // 1. Page Vinted → og:image
    const page = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!page.ok) return NextResponse.json({ success: false, error: `Vinted ${page.status}` }, { status: 502 })
    const html = await page.text()
    const m = html.match(/<meta property="og:image" content="([^"]+)"/i)
    if (!m) return NextResponse.json({ success: false, error: 'Photo introuvable sur la page' }, { status: 404 })
    const imgUrl = m[1]

    // 2. Télécharge l'image
    const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': UA } })
    if (!imgRes.ok) return NextResponse.json({ success: false, error: 'Téléchargement photo échoué' }, { status: 502 })
    const buf = Buffer.from(await imgRes.arrayBuffer())
    const contentType = imgRes.headers.get('content-type') || 'image/webp'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('jpe') ? 'jpg' : 'webp'

    // 3. Ré-héberge sur Bunny
    const storageZone = process.env.BUNNY_STORAGE_ZONE
    const apiKey = process.env.BUNNY_API_KEY
    const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
    if (!storageZone || !apiKey || !cdnUrl) {
      return NextResponse.json({ success: false, error: 'Config Bunny manquante' }, { status: 500 })
    }
    const path = `produits/vinted_${productId}_${Date.now()}.${ext}`
    const put = await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
      method: 'PUT', headers: { AccessKey: apiKey, 'Content-Type': contentType }, body: buf,
    })
    if (!put.ok) return NextResponse.json({ success: false, error: `Bunny ${put.status}` }, { status: 502 })
    const cdn = `${cdnUrl}/${path}`

    // 4. Pose sur la pièce (détail + affichage)
    const ref = adminDb.collection('produits').doc(productId)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ success: false, error: 'Pièce introuvable' }, { status: 404 })
    const cur = snap.data() as any
    const details = Array.isArray(cur?.photos?.details) ? cur.photos.details : []
    const imageUrls = Array.isArray(cur?.imageUrls) ? cur.imageUrls : []
    await ref.set(
      {
        photos: { ...(cur?.photos || {}), details: [...details, cdn] },
        imageUrls: [cdn, ...imageUrls],
        imageUrl: cur?.imageUrl || cdn,
        achatAnnonceUrl: url,
      },
      { merge: true },
    )

    return NextResponse.json({ success: true, url: cdn })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
