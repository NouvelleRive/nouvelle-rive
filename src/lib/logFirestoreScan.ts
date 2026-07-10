// lib/logFirestoreScan.ts
// Debug utility : écrit chaque gros scan Firestore dans _debug/scans pour qu'on
// puisse identifier qui pompe. À retirer une fois la cause trouvée.
//
// Écrit fire-and-forget (pas de await côté appelant). Coût write : 40 chineuses
// × ~100 scans/jour = 4k writes/jour = ~0.04€/mois, négligeable.

import { adminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

export function logFirestoreScan(source: string, docsCount: number, extra?: Record<string, any>) {
  // Log console (pour Vercel Runtime Logs).
  console.log(`[FS-SCAN] ${source} docs=${docsCount}`, extra || '')

  // Persist dans Firestore pour lecture asynchrone.
  // Fire-and-forget : pas de await, si ça plante on ignore silencieusement.
  const doc = {
    source,
    docsCount,
    at: FieldValue.serverTimestamp(),
    atMs: Date.now(),
    ...(extra || {}),
  }
  adminDb
    .collection('_debug')
    .doc('scans')
    .collection('events')
    .add(doc)
    .catch(() => {})
}
