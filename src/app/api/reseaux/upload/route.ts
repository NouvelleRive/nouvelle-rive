import { NextRequest, NextResponse } from 'next/server'

// Upload d'un média (vidéo ou vignette) sur Bunny Storage → renvoie l'URL CDN.
// Gratuit (Bunny), pas de stockage Firestore du binaire.

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const storageZone = process.env.BUNNY_STORAGE_ZONE
    const apiKey = process.env.BUNNY_API_KEY
    const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
    if (!storageZone || !apiKey || !cdnUrl) {
      return NextResponse.json({ success: false, error: 'Bunny non configuré' }, { status: 500 })
    }

    const form = await req.formData()
    const file = form.get('file') as File | null
    const kind = (form.get('kind') as string) || 'media' // 'video' | 'vignette'
    if (!file) return NextResponse.json({ success: false, error: 'fichier manquant' }, { status: 400 })

    const ext = (file.name.split('.').pop() || (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase()
    const rand = Math.random().toString(36).substring(2, 8)
    const stamp = `${Date.now()}_${rand}`
    const path = `reseaux/${kind}/${stamp}.${ext}`

    const buf = Buffer.from(await file.arrayBuffer())
    const up = await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
      method: 'PUT',
      headers: { AccessKey: apiKey, 'Content-Type': file.type || 'application/octet-stream' },
      body: buf,
    })
    if (!up.ok) {
      return NextResponse.json({ success: false, error: `upload Bunny ${up.status}` }, { status: 502 })
    }

    return NextResponse.json({ success: true, url: `${cdnUrl}/${path}` })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
