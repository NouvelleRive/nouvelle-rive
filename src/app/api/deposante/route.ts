// app/api/deposante/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      prenom,
      nom,
      trigramme,
      telephone,
      adresse1,
      adresse2,
      iban,
      bic,
      banqueAdresse,
      modePaiement,
      pieceIdentiteUrl,
    } = body

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

    const adminDb = getFirestore()

    // Chercher le doc par authUid
    let snapshot = await adminDb.collection('deposante')
      .where('authUid', '==', decoded.uid)
      .limit(1)
      .get()

    const updateData: Record<string, any> = {
      authUid: decoded.uid,
      email: decoded.email || '',
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (prenom !== undefined) updateData.prenom = prenom?.trim() || ''
    if (nom !== undefined) updateData.nom = nom?.trim() || ''
    if (trigramme !== undefined) updateData.trigramme = trigramme?.trim().toUpperCase() || ''
    if (telephone !== undefined) updateData.telephone = telephone?.trim() || ''
    if (adresse1 !== undefined) updateData.adresse1 = adresse1?.trim() || ''
    if (adresse2 !== undefined) updateData.adresse2 = adresse2?.trim() || ''
    if (iban !== undefined) updateData.iban = iban?.trim() || ''
    if (bic !== undefined) updateData.bic = bic?.trim() || ''
    if (banqueAdresse !== undefined) updateData.banqueAdresse = banqueAdresse?.trim() || ''
    if (modePaiement !== undefined) updateData.modePaiement = modePaiement || ''
    if (pieceIdentiteUrl !== undefined) updateData.pieceIdentiteUrl = pieceIdentiteUrl?.trim() || ''

    if (snapshot.empty) {
      // Nouveau déposant — créer le document
      updateData.createdAt = FieldValue.serverTimestamp()
      updateData.contratSigne = false
      updateData.cagnotte = 0
      const newRef = adminDb.collection('deposante').doc(decoded.uid)
      await newRef.set(updateData)
      return NextResponse.json({ success: true, action: 'created', id: decoded.uid })
    }

    // Mise à jour
    await snapshot.docs[0].ref.update(updateData)
    return NextResponse.json({ success: true, action: 'updated', id: snapshot.docs[0].id })

  } catch (e: any) {
    console.error('❌ [API DEPOSANTE PATCH]', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
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

    const adminDb = getFirestore()
    const snapshot = await adminDb.collection('deposante')
      .where('authUid', '==', decoded.uid)
      .limit(1)
      .get()

    if (snapshot.empty) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({ success: true, data: snapshot.docs[0].data() })

  } catch (e: any) {
    console.error('❌ [API DEPOSANTE GET]', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}