// POST /api/admin/paiements/controle { mois: 'MM-YYYY' }
// Compare, chineuse par chineuse, le facturé (ventes Firestore) et l'encaissé
// (lignes des commandes Square) du mois. Admin only, à la demande (bouton).
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'
import { ventesSquare } from '@/lib/squareVentes'
import { controlerEncaissement, type VenteControle } from '@/lib/controleEncaissement'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded.email !== ADMIN_EMAIL) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
  } catch {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  const { mois } = await req.json() as { mois?: string }
  const m = /^(\d{2})-(\d{4})$/.exec(mois || '')
  if (!m) return NextResponse.json({ success: false, error: 'mois attendu au format MM-YYYY' }, { status: 400 })
  const numMois = Number(m[1]), an = Number(m[2])
  const debut = new Date(an, numMois - 1, 1, 0, 0, 0)
  const fin = new Date(an, numMois, 0, 23, 59, 59, 999)

  // Ventes du mois — une seule requête bornée, champs utiles seulement.
  const snap = await adminDb.collection('ventes')
    .where('dateVente', '>=', Timestamp.fromDate(debut))
    .where('dateVente', '<=', Timestamp.fromDate(fin))
    .select('sku', 'trigramme', 'orderId', 'lineItemUid', 'prixVenteReel', 'prix', 'prixInitial', 'remiseBlackWeek')
    .get()
  const ventes: VenteControle[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))

  // Commandes Square avec 3 jours de marge (clôture vs date de vente).
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const sq = await ventesSquare(iso(new Date(debut.getTime() - 3 * 864e5)), iso(new Date(fin.getTime() + 3 * 864e5)))
  if (!sq) return NextResponse.json({ success: false, error: 'Square indisponible' }, { status: 502 })

  return NextResponse.json({ success: true, controle: controlerEncaissement(ventes, sq.lignes) })
}
