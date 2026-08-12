// app/api/upload-bunny/route.ts
// Upload d'un média vers Bunny Storage (gratuit).
// - JSON { base64, path, contentType } : images encodées (InventaireList, lib/admin/helpers).
// - multipart form { file, folder } : fichiers volumineux dont vidéos (réseaux).
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_FOLDERS = ['produits/', 'reseaux/']

async function putToBunny(path: string, body: Buffer, contentType: string) {
  const storageZone = process.env.BUNNY_STORAGE_ZONE
  const apiKey = process.env.BUNNY_API_KEY
  const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_CDN_URL
  if (!storageZone || !apiKey || !cdnUrl) {
    return { ok: false as const, status: 500, error: 'Configuration Bunny manquante' }
  }
  const res = await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
    method: 'PUT',
    headers: { AccessKey: apiKey, 'Content-Type': contentType },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false as const, status: 500, error: `Bunny ${res.status} ${text}` }
  }
  return { ok: true as const, url: `${cdnUrl}/${path}` }
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || ''

    // --- Branche multipart (fichiers volumineux / vidéos) ---
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      const folder = ((form.get('folder') as string) || 'reseaux/').replace(/^\/+/, '')
      if (!file) return NextResponse.json({ error: 'fichier requis' }, { status: 400 })
      if (!ALLOWED_FOLDERS.some((f) => folder.startsWith(f))) {
        return NextResponse.json({ error: 'dossier invalide' }, { status: 400 })
      }
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `${folder}${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`
      const buf = Buffer.from(await file.arrayBuffer())
      const r = await putToBunny(path, buf, file.type || 'application/octet-stream')
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
      return NextResponse.json({ url: r.url, path })
    }

    // --- Branche base64 (existant, inchangé) ---
    const { base64, path, contentType } = await req.json()
    if (!base64 || !path) {
      return NextResponse.json({ error: 'base64 et path requis' }, { status: 400 })
    }
    if (!ALLOWED_FOLDERS.some((f) => path.startsWith(f))) {
      return NextResponse.json({ error: 'path invalide' }, { status: 400 })
    }
    const buffer = Buffer.from(base64, 'base64')
    const r = await putToBunny(path, buffer, contentType || 'image/png')
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ url: r.url, path })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}
