// app/api/upload-bunny/route.ts
// Upload d'une image encodée en base64 vers Bunny Storage.
// Utilisé par InventaireList (vendeuse/restock) et lib/admin/helpers.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { base64, path, contentType } = await req.json()

    if (!base64 || !path) {
      return NextResponse.json({ error: 'base64 et path requis' }, { status: 400 })
    }

    // Bloque tout path qui sort du dossier produits/
    if (!path.startsWith('produits/')) {
      return NextResponse.json({ error: 'path invalide' }, { status: 400 })
    }

    const storageZone = process.env.BUNNY_STORAGE_ZONE
    const apiKey = process.env.BUNNY_API_KEY
    const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL

    if (!storageZone || !apiKey || !cdnUrl) {
      return NextResponse.json({ error: 'Configuration Bunny manquante' }, { status: 500 })
    }

    const buffer = Buffer.from(base64, 'base64')

    const bunnyRes = await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
      method: 'PUT',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': contentType || 'image/png',
      },
      body: buffer,
    })

    if (!bunnyRes.ok) {
      const text = await bunnyRes.text().catch(() => '')
      return NextResponse.json(
        { error: `Bunny ${bunnyRes.status} ${text}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ url: `${cdnUrl}/${path}`, path })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}
