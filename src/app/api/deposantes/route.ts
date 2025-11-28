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

    // On envoie TOUS les champs, même vides
    const docData: Record<string, any> = {
      nom: nom?.trim() || '',
      trigramme: trigramme?.trim().toUpperCase() || '',
      email: email?.trim() || '',
      instagram: instagram?.trim() || '',
      accroche: accroche?.trim() || '',
      description: description?.trim() || '',
      specialite: specialite?.trim() || '',
      lien: lien?.trim() || '',
      imageUrl: imageUrl?.trim() || '',
      ordre: typeof ordre === 'number' ? ordre : 0,
      displayOnWebsite: true,
      slug,
    }

    // Catégories avec idsquare - toujours envoyer le tableau
    if (Array.isArray(categories)) {
      docData['Catégorie'] = categories
        .filter((c: any) => c?.label?.trim())
        .map((c: any) => ({
          label: c.label.trim(),
          idsquare: c.idsquare?.trim() || '',
        }))
    } else {
      docData['Catégorie'] = []
    }

    // Catégorie de rapport avec infos comptables
    if (categorieRapport?.label) {
      docData['Catégorie de rapport'] = [{
        label: categorieRapport.label?.trim() || '',
        idsquare: categorieRapport.idsquare?.trim() || '',
        nom: categorieRapport.nom?.trim() || nom?.trim() || '',
        email: categorieRapport.emailCompta?.trim() || email?.trim() || '',
        trigramme: trigramme?.trim().toUpperCase() || '',
        siret: categorieRapport.siret?.trim() || '',
        tva: categorieRapport.tva?.trim() || '',
        iban: categorieRapport.iban?.trim() || '',
        bic: categorieRapport.bic?.trim() || '',
        banqueAdresse: categorieRapport.banqueAdresse?.trim() || '',
        adresse1: categorieRapport.adresse1?.trim() || '',
        adresse2: categorieRapport.adresse2?.trim() || '',
      }]
    } else {
      docData['Catégorie de rapport'] = []
    }

    const ref = adminDb.collection('chineuse').doc(slug)
    const existing = await ref.get()

    if (existing.exists) {
      docData.updatedAt = FieldValue.serverTimestamp()
      await ref.set(docData, { merge: true })  // merge: true pour ne pas écraser les champs non envoyés
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