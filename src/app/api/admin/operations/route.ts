// GET /api/admin/operations — pièces engagées dans l'opération en cours.
// Lecture directe Firestore bornée aux seules pièces remisées (le cache blob
// produits n'est pas rafraîchi quand une chineuse enregistre depuis son espace).
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { serialize } from '@/lib/produitsServer'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded.email !== ADMIN_EMAIL) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
  } catch {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }
  const snap = await adminDb.collection('produits')
    .where('remiseBlackWeek', '>', 0)
    .limit(2000)
    .get()
  // Format grille du site (serialize) + champs de suivi de l'opération
  const produits = snap.docs.map(d => {
    const raw = d.data() as any
    return {
      ...serialize(d.id, raw),
      trigramme: raw.trigramme || null,
      quantite: raw.quantite,
      statut: raw.statut,
      statutRecuperation: raw.statutRecuperation || null,
    }
  })
  return NextResponse.json({ success: true, produits })
}
