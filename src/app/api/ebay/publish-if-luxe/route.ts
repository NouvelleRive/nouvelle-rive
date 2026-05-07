// app/api/ebay/publish-if-luxe/route.ts
// Publie un produit sur eBay s'il match les règles définies dans siteConfig/luxe.
// Appelé après création d'un produit (formulaire chineuse).
// Best-effort : retourne 200 même si rien à faire (no-op), n'échoue jamais bruyamment.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import {
  publishToEbay,
  prepareProductForEbay,
  wearTypeToGender,
  isEbayConfigured,
  type EbayGender,
} from '@/lib/ebay'

type Critere = { type: 'categorie' | 'nom' | 'description' | 'marque' | 'chineuse'; valeur: string }
type Regle = { id: string; criteres: Critere[] }
type LuxeConfig = { regles: Regle[] }
type Chineuse = { uid: string; trigramme?: string; email?: string; wearType?: string }

function matchCritere(p: any, critere: Critere, chineuses: Chineuse[]): boolean {
  if (!critere.valeur) return true
  const v = critere.valeur.toLowerCase()
  switch (critere.type) {
    case 'categorie': {
      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      return (cat || '').toLowerCase().includes(v)
    }
    case 'nom':         return (p.nom || '').toLowerCase().includes(v)
    case 'description': return (p.description || '').toLowerCase().includes(v)
    case 'marque':      return (p.marque || '').toLowerCase().includes(v)
    case 'chineuse': {
      const c = chineuses.find(x => x.uid === critere.valeur)
      if (!c) return false
      if (p.chineur === c.email) return true
      if (p.chineurUid === c.uid) return true
      const tri = c.trigramme?.toUpperCase() || '???'
      const skuU = p.sku?.toUpperCase() || ''
      return skuU.startsWith(tri) && (skuU.length === tri.length || /\d/.test(skuU[tri.length]))
    }
    default: return false
  }
}

function matchesLuxe(p: any, config: LuxeConfig, chineuses: Chineuse[]): boolean {
  if (!config.regles || config.regles.length === 0) return false
  return config.regles.some(r => r.criteres.length > 0 && r.criteres.every(c => matchCritere(p, c, chineuses)))
}

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json()
    if (!productId) return NextResponse.json({ success: false, error: 'productId manquant' }, { status: 400 })
    if (!isEbayConfigured()) return NextResponse.json({ success: true, action: 'noop', reason: 'ebay-non-configure' })

    const produitSnap = await adminDb.collection('produits').doc(String(productId)).get()
    if (!produitSnap.exists) return NextResponse.json({ success: false, error: 'Produit non trouvé' }, { status: 404 })

    const produit: any = { id: produitSnap.id, ...produitSnap.data() }

    if (produit.ebayListingId) return NextResponse.json({ success: true, action: 'noop', reason: 'deja-publie' })
    if (produit.vendu === true) return NextResponse.json({ success: true, action: 'noop', reason: 'vendu' })
    if ((produit.quantite ?? 1) <= 0) return NextResponse.json({ success: true, action: 'noop', reason: 'stock-0' })
    if (produit.statut === 'retour' || produit.statut === 'supprime') return NextResponse.json({ success: true, action: 'noop', reason: 'statut-' + produit.statut })

    const hasImage = (Array.isArray(produit.imageUrls) && produit.imageUrls.length > 0) || produit.imageUrl
    if (!hasImage) return NextResponse.json({ success: true, action: 'noop', reason: 'no-image' })

    const configSnap = await adminDb.collection('siteConfig').doc('luxe').get()
    const config: LuxeConfig = configSnap.exists ? { regles: [], ...(configSnap.data() as any) } : { regles: [] }

    const chineusesSnap = await adminDb.collection('chineuse').get()
    const chineuses: Chineuse[] = chineusesSnap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }))

    if (!matchesLuxe(produit, config, chineuses)) {
      return NextResponse.json({ success: true, action: 'noop', reason: 'no-match-luxe' })
    }

    const tri = (produit.chineuse || produit.trigramme || (produit.sku ? produit.sku.match(/^([A-Z]{2,4})/i)?.[1] : null) || '').toString().toUpperCase()
    const wearType = tri ? chineuses.find(c => c.trigramme?.toUpperCase() === tri)?.wearType : undefined
    const gender: EbayGender | undefined = wearTypeToGender(wearType) || undefined

    const ebayProduct = prepareProductForEbay(produit, gender)
    const result = await publishToEbay(ebayProduct)

    if (!result.success) {
      return NextResponse.json({ success: false, action: 'publish-failed', error: result.error })
    }

    await adminDb.collection('produits').doc(produit.id).update({
      ebayListingId: result.listingId,
      ebayOfferId: result.offerId,
      ebayPublishedAt: new Date().toISOString(),
      publishedOn: Array.from(new Set([...(produit.publishedOn || []), 'ebay'])),
    })

    return NextResponse.json({ success: true, action: 'published', listingId: result.listingId })
  } catch (e: any) {
    console.error('❌ publish-if-luxe:', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'erreur' }, { status: 500 })
  }
}
