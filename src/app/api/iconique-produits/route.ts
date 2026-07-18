// app/api/iconique-produits/route.ts
// Retourne les produits d'un iconique (matching règles), triés selon soldOut/categoriesOrder.
// Utilise les caches serveur mutualisés (produits + iconiques) — 0 read Firestore par visite.

export const runtime = 'nodejs'
export const revalidate = 21600

import { NextRequest, NextResponse } from 'next/server'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'
import { getIconiquesCached } from '@/lib/getIconiquesCached'
import { LUXURY_BRANDS } from '@/lib/admin/helpers'

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’\-_.\s]+/g, '')
}

function toMillis(v: any): number {
  if (!v) return 0
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v === 'string') return new Date(v).getTime() || 0
  if (typeof v === 'number') return v
  if (v?.seconds) return v.seconds * 1000
  return 0
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const [iconiques, allProduits] = await Promise.all([
      getIconiquesCached(),
      getAllProduitsCached(),
    ])

    const current = iconiques.find(i => i.id === id)
    if (!current) {
      return NextResponse.json(
        { produits: [] },
        { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
      )
    }

    const needleNom = norm(current.categorieRecherche || '')
    const needleMarque = norm(current.marque || '')
    const needleMarqueRaw = (current.marque || '').toLowerCase().trim()
    const needleMaterial = norm(current.materialContient || '')
    const trigs = (current.chineuseTrigrammes || []).map(t => t.toUpperCase())
    const catsIn = (current.categoriesIn || []).map(c => norm(c))
    const marquesIn = ((current as any).marquesIn || []).map((m: string) => norm(m)).filter(Boolean)

    if (!needleNom && !needleMarque && !needleMaterial && trigs.length === 0 && catsIn.length === 0 && marquesIn.length === 0) {
      return NextResponse.json(
        { produits: [] },
        { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
      )
    }

    const matchPredicate = (p: any) => {
      const nom = norm(p.nom || p.Nom || '')
      const marque = norm(p.marque || '')
      const cat = typeof p.categorie === 'object' ? norm(p.categorie?.label || '') : norm(p.categorie || '')
      const material = norm(p.material || '')
      const trigramme = (p.trigramme || '').toUpperCase()

      if (needleNom && !nom.includes(needleNom) && !cat.includes(needleNom)) return false
      if (needleMarque) {
        if (needleMarqueRaw === 'luxe') {
          if (!LUXURY_BRANDS.some((b: string) => marque.includes(norm(b)))) return false
        } else {
          if (!marque.includes(needleMarque)) return false
        }
      }
      if (marquesIn.length > 0 && !marquesIn.some((m: string) => marque.includes(m))) return false
      if (trigs.length > 0 && !trigs.includes(trigramme)) return false
      if (catsIn.length > 0 && !catsIn.some(c => cat.includes(c))) return false
      if (needleMaterial && !material.includes(needleMaterial)) return false
      return true
    }

    const allPlain = allProduits.map(({ id: pid, raw }) => ({ id: pid, ...(raw as any) }))
    const activeRaw = allPlain.filter((p: any) => p.vendu !== true)
    const soldRaw = allPlain.filter((p: any) => p.vendu === true)

    const commonFilter = (p: any) =>
      p.statut !== 'retour' &&
      p.statut !== 'supprime' &&
      p.hidden !== true &&
      !!(p.imageUrls?.[0] || p.imageUrl || p.photos?.face)

    const matchedActiveAll = activeRaw
      .filter(commonFilter)
      .filter(matchPredicate)
    const matchedActive = matchedActiveAll.filter((p: any) => (p.quantite ?? 1) > 0)
    // Ruptures (quantite=0 mais non vendus) — on les affiche en fin de grille avec badge.
    const matchedRupture = matchedActiveAll
      .filter((p: any) => (p.quantite ?? 1) <= 0)
      .map((p: any) => ({ ...p, rupture: true }))

    const matchedSold = soldRaw.filter(commonFilter).filter(matchPredicate)

    let result: any[]
    if (current.soldOut) {
      matchedSold.sort((a: any, b: any) => toMillis(b.createdAt) - toMillis(a.createdAt))
      result = matchedSold.slice(0, 8)
    } else {
      if (current.categoriesOrder && current.categoriesOrder.length > 0) {
        const order = current.categoriesOrder.map(c => norm(c))
        const sortByOrder = (a: any, b: any) => {
          const catA = typeof a.categorie === 'object' ? norm(a.categorie?.label || '') : norm(a.categorie || '')
          const catB = typeof b.categorie === 'object' ? norm(b.categorie?.label || '') : norm(b.categorie || '')
          const idxA = order.findIndex(o => catA.includes(o))
          const idxB = order.findIndex(o => catB.includes(o))
          const fa = idxA === -1 ? 999 : idxA
          const fb = idxB === -1 ? 999 : idxB
          return fa - fb
        }
        matchedActive.sort(sortByOrder)
        matchedRupture.sort(sortByOrder)
        matchedSold.sort(sortByOrder)
      }
      result = [...matchedActive, ...matchedRupture, ...matchedSold]
    }

    // Sérialise Timestamp createdAt/dateVente en ms (JSON-safe).
    const produits = result.map(p => ({
      ...p,
      createdAt: toMillis(p.createdAt),
      dateVente: toMillis(p.dateVente),
    }))

    return NextResponse.json(
      { produits },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
