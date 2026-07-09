// src/app/api/google-feed/route.ts
export const revalidate = 43200

import { NextResponse } from 'next/server'
import { buildProduitSlug } from '@/lib/produitSlug'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'
import { getChineusesLiteCached } from '@/lib/getChineusesLiteCached'

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  try {
    // Cache mutualisé (1h) — plus de scan Firestore direct à chaque revalidate.
    const [allProduits, chineuses] = await Promise.all([
      getAllProduitsCached(),
      getChineusesLiteCached(),
    ])

    const chineuseMap: Record<string, string> = {}
    chineuses.forEach(c => {
      if (c.trigramme) chineuseMap[c.trigramme] = c.wearType || 'womenswear'
    })

    const produits = allProduits
      .map(({ id, raw }) => ({ id, ...raw } as any))
      .filter(p =>
        p.statut !== 'supprime' &&
        p.statut !== 'retour' &&
        p.vendu !== true &&
        p.recu !== false &&
        (p.quantite ?? 1) > 0 &&
        p.prix > 0 &&
        (p.photos?.face || p.imageUrl)
      )

    const items = produits.map(p => {
      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie || ''
      const imageUrl = p.photos?.face || p.imageUrls?.[0] || p.imageUrl || ''
      const rawNom = (p.nom || '').replace(new RegExp(`^${p.sku}\\s*-\\s*`, 'i'), '').trim()
      // Google US considère "Redskins" comme un terme offensant — on remplace pour éviter le rejet
      const marqueRaw = (p.marque || '').trim()
      const marque = /redskins/i.test(marqueRaw) ? 'Vintage' : marqueRaw

      // Évite "Ralph Lauren - Ralph Lauren - …" : on n'ajoute la marque que si le nom ne commence pas déjà par
      const cleanedNom = rawNom.replace(/redskins/gi, 'Vintage')
      const nomStartsWithBrand = marque && cleanedNom.toLowerCase().startsWith(marque.toLowerCase())
      let fullTitle = (marque && !nomStartsWithBrand) ? `${marque} - ${cleanedNom}` : cleanedNom
      if (!fullTitle) fullTitle = `${marque || 'Vintage'} ${cat}`.trim()
      // Google : titre max 150 caractères
      if (fullTitle.length > 150) fullTitle = fullTitle.slice(0, 147) + '...'

      const tri = ((p.trigramme || '').toString().toUpperCase())
        || (p.sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase()
        || ''
      const wearType = chineuseMap[tri] || 'womenswear'
      const gender = wearType === 'menswear' ? 'male' : wearType === 'unisex' ? 'unisex' : 'female'

      // Description : Google demande au moins ~50 caractères, sinon les produits sont refusés.
      let description = (p.description || '').trim()
      if (description.length < 50) {
        const parts = [
          marque || 'Pièce',
          cat || 'vintage',
          p.taille ? `taille ${p.taille}` : '',
          p.color || '',
          p.material || '',
          'sélection vintage Nouvelle Rive, Le Marais Paris.',
        ].filter(Boolean)
        description = parts.join(' ').replace(/\s+/g, ' ').trim()
      }

      const url = `https://www.nouvellerive.eu/${buildProduitSlug(p)}`
      const prix = typeof p.prix === 'number' ? p.prix.toFixed(2) : '0.00'
      const mpn = p.sku || p.id

      return `
    <item>
      <g:id>${escapeXml(p.sku || p.id)}</g:id>
      <g:title>${escapeXml(fullTitle)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${url}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
      <g:condition>used</g:condition>
      <g:availability>in_stock</g:availability>
      <g:price>${prix} EUR</g:price>
      <g:brand>${escapeXml(marque || 'Nouvelle Rive')}</g:brand>
      <g:mpn>${escapeXml(mpn)}</g:mpn>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>Apparel &amp; Accessories</g:google_product_category>
      ${cat ? `<g:product_type>${escapeXml(cat)}</g:product_type>` : ''}
      <g:color>${escapeXml(p.color || 'Multicolore')}</g:color>
      ${p.taille ? `<g:size>${escapeXml(p.taille)}</g:size>` : ''}
      ${p.material ? `<g:material>${escapeXml(p.material)}</g:material>` : ''}
      <g:gender>${gender}</g:gender>
      <g:age_group>adult</g:age_group>
    </item>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Nouvelle Rive</title>
    <link>https://www.nouvellerive.eu</link>
    <description>Boutique vintage Nouvelle Rive — Le Marais, Paris</description>
    ${items}
  </channel>
</rss>`

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err: any) {
    console.error('Google feed error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
