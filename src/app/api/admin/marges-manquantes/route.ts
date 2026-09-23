// app/api/admin/marges-manquantes/route.ts
// Les pièces vendues disparaissent de /admin/nos-produits : impossible d'y
// corriger un `prixAchat` oublié. Sans ce prix, la vente compte 0 € de marge
// dans le dashboard (cf. PerformanceContent).
//
// GET  : liste des ventes maison (NR/ACH) d'une année dont le prix d'achat manque,
//        groupées par produit.
// POST : écrit le prixAchat sur le produit ET sur ses ventes (la vente garde
//        ainsi l'info même si la fiche produit bouge), puis patche le cache blob.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { patchBlobCache } from '@/lib/blobCache'
import { HOUSE_PURCHASE_TRIGRAMMES } from '@/lib/roles'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

type Item = { id: string; raw: any }

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!token) return { error: NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 }) }
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded.email !== ADMIN_EMAIL) {
      return { error: NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 }) }
    }
    return { decoded }
  } catch {
    return { error: NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 }) }
  }
}

const toDate = (v: any): Date | null => {
  const d = v?.toDate?.() || (v ? new Date(v) : null)
  return d && !isNaN(d.getTime()) ? d : null
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const annee = Number(new URL(req.url).searchParams.get('annee')) || new Date().getFullYear()

    // Ventes maison de l'année (filtre année en mémoire : évite un index composite).
    const snaps = await Promise.all(
      HOUSE_PURCHASE_TRIGRAMMES.map(tri => adminDb.collection('ventes').where('trigramme', '==', tri).get()),
    )
    const ventes = snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
      .filter(v => toDate(v.dateVente)?.getFullYear() === annee)

    // Prix d'achat déjà connus, lus sur les produits référencés (pas de scan global).
    const produitIds = Array.from(new Set(ventes.map(v => v.produitId).filter(Boolean)))
    const produits = new Map<string, any>()
    for (let i = 0; i < produitIds.length; i += 300) {
      const refs = produitIds.slice(i, i + 300).map(id => adminDb.collection('produits').doc(id))
      const docs = await adminDb.getAll(...refs)
      docs.forEach(d => { if (d.exists) produits.set(d.id, d.data()) })
    }

    const parProduit = new Map<string, any>()
    let ventesSansProduit = 0
    let totalVentes = 0
    let completes = 0
    for (const v of ventes) {
      totalVentes++
      const p = v.produitId ? produits.get(v.produitId) : null
      const pa = typeof v.prixAchat === 'number' ? v.prixAchat : p?.prixAchat
      if (typeof pa === 'number' && pa > 0) { completes++; continue }
      if (!v.produitId || !p) { ventesSansProduit++; continue }
      const prixVente = v.prixVenteReel || v.prix || 0
      const d = toDate(v.dateVente)
      const cur = parProduit.get(v.produitId) || {
        produitId: v.produitId,
        sku: p.sku || v.sku || '-',
        nom: p.nom || v.nom || '-',
        marque: p.marque || null,
        trigramme: v.trigramme || p.trigramme || '',
        image: p.imageUrls?.[0] || p.images?.[0] || p.imageUrl || null,
        ventes: 0,
        ca: 0,
        derniereVente: null as string | null,
      }
      cur.ventes++
      cur.ca += prixVente
      const iso = d ? d.toISOString().slice(0, 10) : null
      if (iso && (!cur.derniereVente || iso > cur.derniereVente)) cur.derniereVente = iso
      parProduit.set(v.produitId, cur)
    }

    const lignes = Array.from(parProduit.values()).sort((a, b) => b.ca - a.ca)
    return NextResponse.json({
      success: true,
      annee,
      lignes,
      stats: {
        totalVentes,
        completes,
        aCompleter: lignes.reduce((s, l) => s + l.ventes, 0),
        produits: lignes.length,
        caACompleter: Math.round(lignes.reduce((s, l) => s + l.ca, 0)),
        ventesSansProduit,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth.error) return auth.error
  try {
    const body = await req.json()
    const maj: { produitId: string; prixAchat: number }[] = Array.isArray(body?.maj) ? body.maj : []
    const valides = maj.filter(m => m?.produitId && typeof m.prixAchat === 'number' && m.prixAchat > 0)
    if (!valides.length) return NextResponse.json({ success: false, error: 'rien à écrire' }, { status: 400 })

    // Écritures par paquets : un batch Firestore plafonne à 500 opérations.
    let batch = adminDb.batch()
    let ops = 0
    const flush = async (force = false) => {
      if (ops === 0 || (!force && ops < 400)) return
      await batch.commit()
      batch = adminDb.batch()
      ops = 0
    }
    for (const { produitId, prixAchat } of valides) {
      batch.update(adminDb.collection('produits').doc(produitId), { prixAchat })
      ops++
      // Les ventes de cette pièce portent aussi le prix d'achat : la marge reste
      // juste même si la fiche produit est modifiée ou supprimée plus tard.
      const ventesSnap = await adminDb.collection('ventes').where('produitId', '==', produitId).get()
      ventesSnap.docs.forEach(d => { batch.update(d.ref, { prixAchat }); ops++ })
      await flush()
    }
    await flush(true)

    // Cache blob `produits-all` : on remplace les fiches touchées (1 read chacune).
    const ids = valides.map(v => v.produitId)
    const fresh = await adminDb.getAll(...ids.map(id => adminDb.collection('produits').doc(id)))
    await patchBlobCache<Item[]>('produits-all', (items) => {
      const majMap = new Map(fresh.filter(d => d.exists).map(d => [d.id, { id: d.id, raw: d.data() } as Item]))
      return items.map(it => majMap.get(it.id) || it)
    })

    return NextResponse.json({ success: true, majs: valides.length })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
