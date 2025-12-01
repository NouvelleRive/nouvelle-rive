// app/api/ateliers/admin/creneaux/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  
  if (!token) {
    return null
  }
  
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded.email !== ADMIN_EMAIL) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}

// GET - Liste des créneaux (admin)
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const db = adminDb
    
    let creneauxQuery = db.collection('ateliers_creneaux').orderBy('date').orderBy('heure')
    
    if (start) {
      creneauxQuery = creneauxQuery.where('date', '>=', start)
    }
    if (end) {
      creneauxQuery = creneauxQuery.where('date', '<=', end)
    }

    const creneauxSnap = await creneauxQuery.get()
    const creneaux = creneauxSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Récupérer les réservations pour ces créneaux
    const creneauIds = creneaux.map(c => c.id)
    let reservations: any[] = []
    
    if (creneauIds.length > 0) {
      // Firestore limite à 10 éléments dans 'in', on fait par batch
      for (let i = 0; i < creneauIds.length; i += 10) {
        const batch = creneauIds.slice(i, i + 10)
        const resaSnap = await db.collection('ateliers_reservations')
          .where('creneauId', 'in', batch)
          .get()
        
        reservations.push(...resaSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })))
      }
    }

    return NextResponse.json({ creneaux, reservations })
  } catch (error: any) {
    console.error('Erreur GET admin créneaux:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Créer un créneau
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const { date, heure, lieu, placesMax } = await req.json()

    if (!date || !heure || !lieu || !placesMax) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    if (!['ecouffes', 'printemps'].includes(lieu)) {
      return NextResponse.json({ error: 'Lieu invalide' }, { status: 400 })
    }

    const db = adminDb
    
    const docRef = await db.collection('ateliers_creneaux').add({
      date,
      heure,
      lieu,
      placesMax,
      placesReservees: 0,
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
    })
  } catch (error: any) {
    console.error('Erreur POST admin créneau:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer un créneau
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
    }

    const db = adminDb
    
    // Vérifier s'il y a des réservations
    const resaSnap = await db.collection('ateliers_reservations')
      .where('creneauId', '==', id)
      .limit(1)
      .get()

    if (!resaSnap.empty) {
      return NextResponse.json({ 
        error: 'Impossible de supprimer : des réservations existent' 
      }, { status: 400 })
    }

    await db.collection('ateliers_creneaux').doc(id).delete()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur DELETE admin créneau:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}