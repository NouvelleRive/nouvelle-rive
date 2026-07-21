// TEMP diag : état eBay d'un SKU (offer + listing). À supprimer après debug.
import { NextRequest, NextResponse } from 'next/server'
import { ebayApiCall } from '@/lib/ebay'

export async function GET(req: NextRequest) {
  const sku = new URL(req.url).searchParams.get('sku')
  if (!sku) return NextResponse.json({ error: 'sku requis' }, { status: 400 })
  const out: any = { sku }
  try {
    const offers = await ebayApiCall<any>(`/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`, { method: 'GET' })
    out.offers = (offers.offers || []).map((o: any) => ({
      offerId: o.offerId,
      status: o.status,
      listingId: o.listing?.listingId,
      listingStatus: o.listing?.listingStatus,
      categoryId: o.categoryId,
      marketplaceId: o.marketplaceId,
    }))
  } catch (e: any) {
    out.offersError = e?.message
  }
  try {
    const inv = await ebayApiCall<any>(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, { method: 'GET' })
    out.inventory = { condition: inv.condition, hasImages: (inv.product?.imageUrls || []).length, title: inv.product?.title }
  } catch (e: any) {
    out.inventoryError = e?.message
  }
  return NextResponse.json(out)
}
