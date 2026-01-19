// src/app/api/upload-bunny/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { base64, path, contentType } = await req.json()

    if (!base64 || !path) {
      return NextResponse.json({ error: 'base64 et path requis' }, { status: 400 })
    }

    const storageZone = process.env.BUNNY_STORAGE_ZONE
    const apiKey = process.env.BUNNY_API_KEY
    const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL

    if (!storageZone || !apiKey || !cdnUrl) {
      return NextResponse.json({ error: 'Configuration Bunny manquante' }, { status: 500 })
    }

    const buffer = Buffer.from(base64, 'base64')

    const response = await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
      method: 'PUT',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': contentType || 'application/octet-stream',
      },
      body: buffer,
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Upload failed: ${response.status}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: `${cdnUrl}/${path}` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}