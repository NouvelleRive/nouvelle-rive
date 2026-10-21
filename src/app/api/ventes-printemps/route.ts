// app/api/ventes-printemps/route.ts
// Ventes du corner Printemps, saisies à la main par les chineuses du stand.
// Réservé à INES PINEAU, TÊTE D'ORANGE, CHINEUZ2BLING (+ admin).
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { EMAILS_PRINTEMPS, PROPRIETAIRES_PRINTEMPS as PROPRIETAIRES, CANAUX_PRINTEMPS as CANAUX } from '@/lib/ventesPrintemps'

const MAX_VENTES = 300

async function emailAutorise(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return decoded.email && EMAILS_PRINTEMPS.includes(decoded.email) ? decoded.email : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const email = await emailAutorise(req)
  if (!email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Fiche de la chineuse connectée, pour l'en-tête de sa facture PRI.
  const chSnap = await adminDb.collection('chineuse').where('email', '==', email).limit(1).get()
  const c = chSnap.docs[0]?.data()
  const chineuse = c ? {
    nom: c.nom, siret: c.siret, adresse1: c.adresse1, adresse2: c.adresse2, tva: c.tva,
    iban: c.iban, bic: c.bic, banqueAdresse: c.banqueAdresse, taux: c.taux, codeChineuse: c.trigramme,
  } : null

  const snap = await adminDb.collection('ventesPrintemps')
    .orderBy('dateVente', 'desc')
    .limit(MAX_VENTES)
    .get()
  const ventes = snap.docs.map(d => {
    const v = d.data()
    return {
      id: d.id,
      description: v.description,
      prix: v.prix,
      proprietaire: v.proprietaire,
      photoPiece: v.photoPiece,
      photoTicket: v.photoTicket,
      dateVente: v.dateVente,
      canal: v.canal,
      saisiePar: v.saisiePar,
    }
  })
  return NextResponse.json({ ventes, chineuse })
}

export async function POST(req: NextRequest) {
  const email = await emailAutorise(req)
  if (!email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const b = await req.json()
  const id = String(b.id || '')
  const description = String(b.description || '').trim()
  const prix = Number(b.prix)
  const dateVente = String(b.dateVente || '')

  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'description requise' }, { status: 400 })
  if (!Number.isFinite(prix) || prix <= 0) return NextResponse.json({ error: 'prix invalide' }, { status: 400 })
  if (!PROPRIETAIRES.includes(b.proprietaire)) return NextResponse.json({ error: 'propriétaire invalide' }, { status: 400 })
  if (!CANAUX.includes(b.canal)) return NextResponse.json({ error: 'vendu sur invalide' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVente)) return NextResponse.json({ error: 'date invalide' }, { status: 400 })
  if (!b.photoPiece || !b.photoTicket) return NextResponse.json({ error: 'photos requises' }, { status: 400 })

  // ID fourni par le client : un double clic ou un renvoi réécrit la même vente.
  await adminDb.collection('ventesPrintemps').doc(id).set({
    description,
    prix,
    proprietaire: b.proprietaire,
    photoPiece: String(b.photoPiece),
    photoTicket: String(b.photoTicket),
    dateVente,
    canal: b.canal,
    saisiePar: email,
    createdAt: FieldValue.serverTimestamp(),
  })
  return NextResponse.json({ ok: true, id })
}
