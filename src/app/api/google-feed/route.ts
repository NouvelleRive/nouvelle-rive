// src/app/api/google-feed/route.ts
import { NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

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
    const db = getFirestore()
    const [snap, chineuseSnap] = await Promise.all([
      db.collection('produits').get(),
      db.collection('chineuse').get(),
    ])

    const chineuseMap: Record<string, string> = {}
    chineuseSnap.docs.forEach(d => {
      const tri = (d.data().trigramme || '').toUpperCase()
      const wearType = d.data().wearType || 'womenswear'
      if (tri) chineuseMap[tri] = wearType
    })

    const produits = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(p =>
        p.statut !== 'supprime' &&
        p.statut !== 'retour' &&
        p.vendu !== true &&
        (p.quantite ?? 1) > 0 &&
        p.prix > 0 &&
        (p.photos?.face || p.imageUrl)
      )

    const items = produits.map(p => {
      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie || ''
      const imageUrl = p.photos?.face || p.imageUrls?.[0] || p.imageUrl || ''
      const title = (p.nom || '').replace(new RegExp(`^${p.sku}\\s*-\\s*`, 'i'), '')
      const fullTitle = p.marque ? `${p.marque} - ${title}` : title
      const description = p.description || `${cat} vintage ${p.marque || ''} ${p.taille || ''}`.trim()
      const url = `https://www.nouvellerive.eu/boutique/${p.id}`
      const prix = typeof p.prix === 'number' ? p.prix.toFixed(2) : '0.00'
      const tri = (p.sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || ''
      const wearType = chineuseMap[tri] || 'womenswear'
      const gender = wearType === 'menswear' ? 'male' : wearType === 'unisex' ? 'unisex' : 'female'

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
      <g:brand>${escapeXml(p.marque || 'Nouvelle Rive')}</g:brand>
      <g:google_product_category>Apparel &amp; Accessories</g:google_product_category>
      ${cat ? `<g:product_type>${escapeXml(cat)}</g:product_type>` : ''}
      ${p.color ? `<g:color>${escapeXml(p.color)}</g:color>` : ''}
      ${p.taille ? `<g:size>${escapeXml(p.taille)}</g:size>` : ''}
      ${p.material ? `<g:material>${escapeXml(p.material)}</g:material>` : ''}
      <g:gender>${gender}</g:gender>
      <g:age_group>adult</g:age_group>
      ${!p.color ? `<g:color>Multicolore</g:color>` : ''}
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
