// app/api/ateliers/webhook/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebaseAdmin'
import crypto from 'crypto'

const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY

function verifySquareSignature(body: string, signature: string): boolean {
  if (!SQUARE_WEBHOOK_SIGNATURE_KEY) return false
  const hmac = crypto.createHmac('sha256', SQUARE_WEBHOOK_SIGNATURE_KEY)
  hmac.update(body)
  const expectedSignature = hmac.digest('base64')
  return signature === expectedSignature
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-square-hmacsha256-signature') || ''

  // Vérifier signature (optionnel mais recommandé)
  if (SQUARE_WEBHOOK_SIGNATURE_KEY && !verifySquareSignature(body, signature)) {
    console.error('Invalid Square webhook signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Paiement complété
  if (event.type === 'payment.completed' || event.type === 'order.fulfillment.updated') {
    const orderId = event.data?.object?.order_id || event.data?.object?.id

    if (orderId) {
      // Chercher la réservation par orderId
      const resaSnap = await adminDb.collection('ateliers_reservations')
        .where('squareOrderId', '==', orderId)
        .limit(1)
        .get()

      if (!resaSnap.empty) {
        const resaDoc = resaSnap.docs[0]
        const resaData = resaDoc.data()

        if (!resaData.paye) {
          // Marquer comme payé
          await resaDoc.ref.update({
            paye: true,
            paidAt: FieldValue.serverTimestamp(),
          })

          // Mettre à jour les places du créneau
          const creneauRef = adminDb.collection('ateliers_creneaux').doc(resaData.creneauId)
          await creneauRef.update({
            placesReservees: FieldValue.increment(resaData.participants),
          })

          console.log(`✅ Réservation ${resaDoc.id} confirmée - ${resaData.participants} participant(s)`)
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}