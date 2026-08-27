// app/api/acheteuse/strategie/route.ts
// Stratégie d'achat de l'acheteuse.
//   GET   → { objectif, realise } — objectif lu sur le doc chineuse ACH,
//           réalisé calculé depuis le cache blob produits (0 read Firestore).
//   PATCH → enregistre l'objectif sur le doc chineuse ACH.
//
// Auth : acheteuse ou admin (ID token Firebase).

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { getAllProduitsCached, forceRefreshProduitsBlob } from '@/lib/getAllProduitsCached'
import { ADMIN_EMAIL, ACHETEUSE_EMAIL, ACHETEUSE_TRIGRAMME, ACHETEUSE_CHINEUSE_DOC } from '@/lib/roles'
import {
  evaluer,
  OBJECTIF_VIDE,
  type StrategieObjectif,
  type StrategieProduit,
  type StrategieRule,
  type AxisKey,
} from '@/modules/achat-strategie/types'

const ALLOWED = new Set([ADMIN_EMAIL, ACHETEUSE_EMAIL])

async function authEmail(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const email = (decoded.email || '').toLowerCase()
    return ALLOWED.has(email) ? email : null
  } catch {
    return null
  }
}

const VALID_AXES: AxisKey[] = ['color', 'categorie', 'marque', 'modele', 'motif', 'taille', 'closureType', 'prix']

/** Nettoie/valide l'objectif reçu du client avant écriture. */
function sanitizeObjectif(input: any): StrategieObjectif {
  const cibleStock = Math.max(0, Math.round(Number(input?.cibleStock) || 0))
  const rawRules = Array.isArray(input?.rules) ? input.rules : []
  const rules: StrategieRule[] = rawRules
    .map((r: any, i: number): StrategieRule | null => {
      const axis = r?.axis as AxisKey
      if (!VALID_AXES.includes(axis)) return null
      const match = String(r?.match ?? '').trim().slice(0, 80)
      if (!match) return null
      return {
        id: String(r?.id || `r${i}_${match}`).slice(0, 64),
        label: String(r?.label ?? '').trim().slice(0, 80) || match,
        axis,
        match,
        targetPct: Math.min(100, Math.max(0, Math.round(Number(r?.targetPct) || 0))),
      }
    })
    .filter((r: StrategieRule | null): r is StrategieRule => !!r)
    .slice(0, 40)
  return { cibleStock, rules }
}

async function readObjectif(): Promise<StrategieObjectif> {
  const snap = await adminDb.collection('chineuse').doc(ACHETEUSE_CHINEUSE_DOC).get()
  const raw = snap.exists ? (snap.data() as any)?.strategieAchat : null
  if (!raw) return OBJECTIF_VIDE
  return sanitizeObjectif(raw)
}

async function readProduitsACH(): Promise<StrategieProduit[]> {
  // Cache blob (0 lecture Firestore). Peut être périmé jusqu'à 6h après un tag —
  // le bouton "Actualiser" côté page force le refresh (cf. GET ?refresh=1).
  const all = await getAllProduitsCached()
  return all
    .map(({ raw }) => raw as any)
    .filter((p) => (p?.trigramme || '').toUpperCase() === ACHETEUSE_TRIGRAMME)
    .map((p): StrategieProduit => ({
      color: p.color,
      categorie: p.categorie,
      marque: p.marque,
      modele: p.modele,
      motif: p.motif,
      taille: p.taille,
      garmentLength: p.garmentLength,
      sleeveLength: p.sleeveLength,
      closureType: p.closureType,
      prix: typeof p.prix === 'number' ? p.prix : null,
      vendu: !!p.vendu,
      achatStatut: p.achatStatut,
    }))
}

export async function GET(req: NextRequest) {
  const email = await authEmail(req)
  if (!email) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  try {
    // ?refresh=1 : reconstruit le cache blob produits AVANT de lire (bouton
    // "Actualiser"). Sinon on sert le cache (0 lecture Firestore).
    if (req.nextUrl.searchParams.get('refresh') === '1') {
      await forceRefreshProduitsBlob()
    }
    const [objectif, produits] = await Promise.all([readObjectif(), readProduitsACH()])
    const realise = evaluer(objectif, produits)
    return NextResponse.json(
      { success: true, objectif, realise },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const email = await authEmail(req)
  if (!email) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const objectif = sanitizeObjectif(body?.objectif ?? body)
    await adminDb.collection('chineuse').doc(ACHETEUSE_CHINEUSE_DOC).set(
      { strategieAchat: objectif, updatedAt: new Date() },
      { merge: true },
    )
    const produits = await readProduitsACH()
    const realise = evaluer(objectif, produits)
    return NextResponse.json({ success: true, objectif, realise })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
