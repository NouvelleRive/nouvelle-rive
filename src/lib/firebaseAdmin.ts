// src/lib/firebaseAdmin.ts
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // transforme les "\n" en vrais retours à la ligne
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Variables Firebase Admin manquantes (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).')
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

export const adminDb = getFirestore()
export const adminAuth = getAuth()

// ✅ Ignorer les valeurs undefined lors de l'écriture dans Firestore
adminDb.settings({ ignoreUndefinedProperties: true })