// app/api/creatrice-page/route.ts
// Retourne tout ce dont /nos-creatrices/[slug] a besoin :
// - la fiche chineuse
// - la liste ordonnée des slugs (pour nav prev/next)
// - les produits actifs de cette chineuse (filtrés selon règles boutique)
//
// Alimenté par les caches serveur mutualisés — 0 read Firestore par visite publique.

export const runtime = 'nodejs'
export const revalidate = 21600

import { NextRequest, NextResponse } from 'next/server'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'
import { getChineusesLiteCached } from '@/lib/getChineusesLiteCached'

function toMillis(v: any): number | null {
  if (!v) return null
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v === 'string') {
    const t = new Date(v).getTime()
    return Number.isFinite(t) ? t : null
  }
  if (typeof v === 'number') return v
  if (v?.seconds) return v.seconds * 1000
  return null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug') || ''
    if (!slug) return NextResponse.json({ error: 'slug requis' }, { status: 400 })

    const [chineuses, allProduits] = await Promise.all([
      getChineusesLiteCached(),
      getAllProduitsCached(),
    ])

    // Liste ordonnée des slugs pour navigation prev/next.
    const allSlugs = [...chineuses]
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
      .map(c => c.slug || c.uid)

    const chineuse = chineuses.find(c => (c.slug || c.uid) === slug || c.uid === slug)
    if (!chineuse) {
      return NextResponse.json(
        { chineuse: null, allSlugs, produits: [] },
        { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
      )
    }

    const tri = (chineuse.trigramme || '').toUpperCase()
    const isSmallBatch = chineuse.stockType === 'smallBatch'

    // Filtre produits actifs de cette chineuse.
    const produits = allProduits
      .map(({ id, raw }) => ({ id, ...raw } as any))
      .filter(p => {
        if (p.vendu) return false
        if ((p.quantite ?? 1) <= 0) return false
        if (p.statut === 'retour' || p.statut === 'supprime') return false
        if (p.hidden === true) return false
        if (p.forceDisplay === false) return false
        if (p.recu === false) return false
        const hasImage =
          (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) || p.imageUrl || p.photos?.face
        if (!hasImage) return false
        // Match par trigramme du produit (ou fallback SKU commence par trigramme).
        const prodTri = (p.trigramme || '').toString().toUpperCase()
        if (prodTri && prodTri === tri) return true
        const skuUp = (p.sku || '').toUpperCase()
        return tri && skuUp.startsWith(tri) &&
          (skuUp.length === tri.length || /\d/.test(skuUp[tri.length] || ''))
      })

    // Tri : smallBatch → likesCount desc, sinon → date création desc.
    if (isSmallBatch) {
      produits.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
    } else {
      produits.sort((a, b) => (toMillis(b.createdAt) || 0) - (toMillis(a.createdAt) || 0))
    }

    const produitsSlim = produits.map(p => ({
      id: p.id,
      nom: p.nom || 'Produit',
      marque: p.marque || '',
      prix: p.prix || 0,
      imageUrl:
        (Array.isArray(p.imageUrls) && p.imageUrls[0]) ||
        p.imageUrl ||
        p.photos?.face ||
        '',
    }))

    // Sanitize la chineuse — strip authUid, emails, email avant exposition publique.
    const chineusePublic = {
      nom: chineuse.nom || '',
      slug: chineuse.slug || chineuse.uid,
      trigramme: chineuse.trigramme || '',
      specialite: chineuse.specialite || '',
      accroche: chineuse.accroche || '',
      accrocheEn: chineuse.accrocheEn || '',
      description: chineuse.description || '',
      descriptionEn: chineuse.descriptionEn || '',
      lien: chineuse.lien || '',
      instagram: chineuse.instagram || '',
      imageUrl: chineuse.imageUrl || '',
      stockType: chineuse.stockType || '',
      videos: chineuse.videos || [],
      instagramFeatured: chineuse.instagramFeatured || '',
    }

    return NextResponse.json(
      { chineuse: chineusePublic, allSlugs, produits: produitsSlim },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
