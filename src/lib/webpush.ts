// Helper serveur pour envoyer des web pushes
import webpush from 'web-push'
import { adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:nouvelleriveparis@gmail.com'

let configured = false
function configure() {
  if (configured) return
  if (!PUBLIC_KEY || !PRIVATE_KEY) throw new Error('VAPID keys manquantes')
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY)
  configured = true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
}

// Envoie une notif à toutes les subscriptions d'un user (= ownerId).
// ownerId peut être : 'boutique', un chineurUid, un email, peu importe — on stocke
// les subscriptions par ownerId.
export async function sendPushToOwner(ownerId: string, payload: PushPayload) {
  configure()
  const snap = await adminDb.collection('pushSubscriptions').where('ownerId', '==', ownerId).get()
  const results = await Promise.all(snap.docs.map(async (doc) => {
    const data = doc.data()
    try {
      await webpush.sendNotification(
        { endpoint: data.endpoint, keys: data.keys },
        JSON.stringify(payload)
      )
      return { id: doc.id, ok: true }
    } catch (err: any) {
      const status = err?.statusCode
      // 404/410 = subscription expirée → on supprime
      if (status === 404 || status === 410) {
        await doc.ref.delete()
      }
      return { id: doc.id, ok: false, status, message: err?.message }
    }
  }))
  console.log(`📨 Push "${payload.title}" → ${ownerId} : ${results.filter(r => r.ok).length}/${results.length} ok`)
  return results
}

// Enregistre / met à jour une subscription pour un owner.
export async function upsertSubscription(ownerId: string, subscription: any) {
  const endpoint = subscription.endpoint
  if (!endpoint) throw new Error('endpoint manquant')
  const id = endpoint.replace(/[^a-zA-Z0-9]/g, '_').slice(-100)
  await adminDb.collection('pushSubscriptions').doc(id).set({
    ownerId,
    endpoint,
    keys: subscription.keys,
    createdAt: Timestamp.now(),
  })
  return { id }
}
