// app/api/acheteuse/investi/route.ts
// Montant investi sur le stock acheté par l'acheteuse (trigramme ACH) : somme de
// (prixAchat + fraisPort). Sert la ligne « Montant investi » du P&L de la page
// perf acheteuse — un cumul GLOBAL (tout ce qui a été mis dans le portant depuis
// le début), avec le détail de ce qui est encore en surface. Le découpage par
// mois reste fourni pour d'éventuels usages ultérieurs.
//
// Lu depuis le cache blob produits → 0 lecture Firestore.
// Auth : acheteuse ou admin (ID token Firebase).

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'
import { toMillis } from '@/lib/produitsServer'
import { ADMIN_EMAIL, ACHETEUSE_EMAIL, ACHETEUSE_TRIGRAMME } from '@/lib/roles'

const ALLOWED = new Set([ADMIN_EMAIL, ACHETEUSE_EMAIL])

async function authOk(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!token) return false
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return ALLOWED.has((decoded.email || '').toLowerCase())
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  if (!(await authOk(req))) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }
  try {
    const all = await getAllProduitsCached()
    // Clé `yyyy-MM` → { montant, pieces }. La date d'achat est celle de la
    // commande sur la plateforme (`achatDateCommande`) ; à défaut la date de
    // création de la fiche (saisie manuelle, import rétroactif…).
    const parMois: Record<string, { montant: number; pieces: number }> = {}
    const total = { montant: 0, pieces: 0 }
    // Part encore immobilisée : pièces en boutique et pas encore vendues.
    const enSurface = { montant: 0, pieces: 0 }
    for (const { raw } of all) {
      const p = raw as any
      if ((p?.trigramme || '').toUpperCase() !== ACHETEUSE_TRIGRAMME) continue
      const prixAchat = typeof p.prixAchat === 'number' ? p.prixAchat : 0
      const fraisPort = typeof p.fraisPort === 'number' ? p.fraisPort : 0
      const cout = prixAchat + fraisPort

      total.montant += cout
      total.pieces += 1
      if (p.recu === true && !p.vendu) {
        enSurface.montant += cout
        enSurface.pieces += 1
      }

      const ms = toMillis(p.achatDateCommande) || toMillis(p.createdAt)
      if (!ms) continue
      const d = new Date(ms)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const cur = parMois[key] || { montant: 0, pieces: 0 }
      parMois[key] = { montant: cur.montant + cout, pieces: cur.pieces + 1 }
    }
    for (const k of Object.keys(parMois)) {
      parMois[k].montant = Math.round(parMois[k].montant)
    }
    total.montant = Math.round(total.montant)
    enSurface.montant = Math.round(enSurface.montant)
    return NextResponse.json(
      { success: true, total, enSurface, parMois },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
