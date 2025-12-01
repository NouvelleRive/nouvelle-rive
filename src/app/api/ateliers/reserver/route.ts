// app/api/ateliers/reserver/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebaseAdmin'
import { Client, Environment } from 'square'

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production,
})

export async function POST(req: NextRequest) {
  try {
    const { creneauId, nom, email, telephone, participants } = await req.json()

    if (!creneauId || !nom || !email || !telephone || !participants) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Vérifier le créneau
    const creneauRef = adminDb.collection('ateliers_creneaux').doc(creneauId)
    const creneauSnap = await creneauRef.get()
    
    if (!creneauSnap.exists) {
      return NextResponse.json({ error: 'Créneau introuvable' }, { status: 404 })
    }

    const creneau = creneauSnap.data()!
    const placesRestantes = creneau.placesMax - creneau.placesReservees

    if (participants > placesRestantes) {
      return NextResponse.json({ error: `Seulement ${placesRestantes} place(s) disponible(s)` }, { status: 400 })
    }

    // Créer la réservation
    const reservationRef = await adminDb.collection('ateliers_reservations').add({
      creneauId,
      nom,
      email,
      telephone,
      participants,
      paye: false,
      createdAt: FieldValue.serverTimestamp(),
    })

    // Créer checkout Square
    const montant = participants * 20 * 100 // 20€ par personne en centimes

    const { result } = await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey: `atelier-${reservationRef.id}-${Date.now()}`,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        lineItems: [
          {
            name: `Atelier Upcycling Bijoux - ${participants} personne(s)`,
            quantity: '1',
            basePriceMoney: {
              amount: BigInt(montant),
              currency: 'EUR',
            },
            note: `Acompte atelier du ${creneau.date} à ${creneau.heure}`,
          },
        ],
      },
      checkoutOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/ateliers/confirmation?reservation=${reservationRef.id}`,
      },
      prePopulatedData: {
        buyerEmail: email,
      },
    })

    // Mettre à jour la réservation avec l'ID Square
    await reservationRef.update({
      squarePaymentLinkId: result.paymentLink?.id,
      squareOrderId: result.paymentLink?.orderId,
    })

    return NextResponse.json({ 
      success: true, 
      reservationId: reservationRef.id,
      checkoutUrl: result.paymentLink?.url,
    })
  } catch (error: any) {
    console.error('Erreur réservation:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}