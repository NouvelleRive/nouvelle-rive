// app/api/ateliers/admin/creneaux/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

/**
 * GET - Récupérer tous les créneaux (avec réservations)
 */
export async function GET(req: NextRequest) {
  try {
    const creneauxSnap = await adminDb.collection('ateliers_creneaux')
      .orderBy('date', 'asc')
      .get()
    
    const creneaux = await Promise.all(creneauxSnap.docs.map(async (doc) => {
      const data = doc.data()
      
      // Récupérer les réservations pour ce créneau
      const reservationsSnap = await adminDb.collection('ateliers_reservations')
        .where('creneauId', '==', doc.id)
        .get()
      
      const reservations = reservationsSnap.docs.map(rDoc => ({
        id: rDoc.id,
        ...rDoc.data(),
        createdAt: rDoc.data().createdAt?.toDate?.()?.toISOString() || null,
      }))
      
      return {
        id: doc.id,
        date: data.date,
        heure: data.heure,
        lieu: data.lieu,
        animatrice: data.animatrice || 'Non assignée',
        placesMax: data.placesMax || 4,
        placesReservees: data.placesReservees || 0,
        reservations,
      }
    }))
    
    return NextResponse.json({ success: true, creneaux })
    
  } catch (err: any) {
    console.error('[ADMIN CRENEAUX GET]', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * POST - Créer un nouveau créneau
 * Body: { date, heure, lieu, animatrice, placesMax }
 */
export async function POST(req: NextRequest) {
  try {
    const { date, heure, lieu, animatrice, placesMax } = await req.json()
    
    if (!date || !heure || !lieu) {
      return NextResponse.json(
        { success: false, error: 'Date, heure et lieu requis' },
        { status: 400 }
      )
    }
    
    const docRef = await adminDb.collection('ateliers_creneaux').add({
      date,
      heure,
      lieu,
      animatrice: animatrice || 'Non assignée',
      placesMax: placesMax || 4,
      placesReservees: 0,
      createdAt: Timestamp.now(),
    })
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Créneau créé',
    })
    
  } catch (err: any) {
    console.error('[ADMIN CRENEAUX POST]', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Modifier un créneau
 * Body: { id, ...fieldsToUpdate }
 */
export async function PUT(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json()
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requis' },
        { status: 400 }
      )
    }
    
    await adminDb.collection('ateliers_creneaux').doc(id).update({
      ...updates,
      updatedAt: Timestamp.now(),
    })
    
    return NextResponse.json({
      success: true,
      message: 'Créneau mis à jour',
    })
    
  } catch (err: any) {
    console.error('[ADMIN CRENEAUX PUT]', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Supprimer un créneau
 * Body: { id }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requis' },
        { status: 400 }
      )
    }
    
    // Vérifier s'il y a des réservations
    const reservationsSnap = await adminDb.collection('ateliers_reservations')
      .where('creneauId', '==', id)
      .get()
    
    if (!reservationsSnap.empty) {
      return NextResponse.json(
        { success: false, error: 'Impossible de supprimer un créneau avec des réservations' },
        { status: 400 }
      )
    }
    
    await adminDb.collection('ateliers_creneaux').doc(id).delete()
    
    return NextResponse.json({
      success: true,
      message: 'Créneau supprimé',
    })
    
  } catch (err: any) {
    console.error('[ADMIN CRENEAUX DELETE]', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}