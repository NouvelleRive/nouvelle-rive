// src/app/api/google-feed-local/route.ts
// Feed d'inventaire local Google Merchant : indique à Google que chaque produit
// est dispo dans la boutique physique (8 rue des Écouffes, 75004 Paris).
// Le store_code doit correspondre à celui déclaré dans Merchant Center → Magasins.
export const revalidate = 3600

import { NextResponse } from 'next/server'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'

const STORE_CODE = '10929298200958467105'

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
    // Cache mutualisé (1h) — évite un scan Firestore par revalidate.
    const allProduits = await getAllProduitsCached()

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
      const id = p.sku || p.id
      const quantite = p.quantite ?? 1
      const prix = typeof p.prix === 'number' ? p.prix.toFixed(2) : '0.00'

      return `
    <item>
      <g:id>${escapeXml(id)}</g:id>
      <g:store_code>${STORE_CODE}</g:store_code>
      <g:quantity>${quantite}</g:quantity>
      <g:availability>in_stock</g:availability>
      <g:price>${prix} EUR</g:price>
      <g:pickup_method>buy</g:pickup_method>
      <g:pickup_sla>same day</g:pickup_sla>
    </item>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Nouvelle Rive — Inventaire local</title>
    <link>https://www.nouvellerive.eu</link>
    <description>Disponibilité en boutique 8 rue des Écouffes, 75004 Paris</description>
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
    console.error('Local inventory feed error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
