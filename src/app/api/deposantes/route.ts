// app/api/deposantes/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

function generateSlug(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      nom,
      trigramme,
      email,
      instagram,
      accroche,
      description,
      specialite,
      lien,
      imageUrl,
      ordre,
      categories,
      categorieRapport,
    } = body

    if (!nom?.trim()) {
      return NextResponse.json({ success: false, error: 'Nom obligatoire' }, { status: 400 })
    }
    if (!trigramme?.trim()) {
      return NextResponse.json({ success: false, error: 'Trigramme obligatoire' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ success: false, error: 'Non authentifiée' }, { status: 401 })
    }

    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(token)
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalide' }, { status: 401 })
    }

    if (decoded.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'Accès réservé admin' }, { status: 403 })
    }

    const adminDb = getFirestore()
    const slug = id || generateSlug(nom.trim())

    const docData: Record<string, any> = {
      nom: nom.trim(),
      trigramme: trigramme.trim().toUpperCase(),
      displayOnWebsite: true,
      slug,
    }

    if (email?.trim()) docData.email = email.trim()
    if (instagram?.trim()) docData.instagram = instagram.trim()
    if (accroche?.trim()) docData.accroche = accroche.trim()
    if (description?.trim()) docData.description = description.trim()
    if (specialite?.trim()) docData.specialite = specialite.trim()
    if (lien?.trim()) docData.lien = lien.trim()
    if (imageUrl?.trim()) docData.imageUrl = imageUrl.trim()
    if (typeof ordre === 'number') docData.ordre = ordre

    if (Array.isArray(categories)) {
      docData['Catégorie'] = categories.filter((c: string) => c?.trim())
    }

    if (categorieRapport?.label) {
      docData['Catégorie de rapport'] = [{
        label: categorieRapport.label,
        idsquare: categorieRapport.idsquare || '',
      }]
    }

    const ref = adminDb.collection('chineuse').doc(slug)
    const existing = await ref.get()

    if (existing.exists) {
      docData.updatedAt = FieldValue.serverTimestamp()
      await ref.update(docData)
      return NextResponse.json({ success: true, action: 'updated', id: slug })
    } else {
      docData.createdAt = FieldValue.serverTimestamp()
      await ref.set(docData)
      return NextResponse.json({ success: true, action: 'created', id: slug })
    }

  } catch (e: any) {
    console.error('❌ [API DEPOSANTES]', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID manquant' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ success: false, error: 'Non authentifiée' }, { status: 401 })
    }

    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(token)
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalide' }, { status: 401 })
    }

    if (decoded.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'Accès réservé admin' }, { status: 403 })
    }

    const adminDb = getFirestore()
    await adminDb.collection('chineuse').doc(id).delete()

    return NextResponse.json({ success: true, action: 'deleted', id })

  } catch (e: any) {
    console.error('❌ [API DEPOSANTES DELETE]', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}