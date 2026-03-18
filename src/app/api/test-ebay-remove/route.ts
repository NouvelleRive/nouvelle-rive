import { NextRequest, NextResponse } from 'next/server'
import { removeFromEbay } from '@/lib/ebay/remove'

export async function POST(req: NextRequest) {
  const { sku, offerId } = await req.json()
  const result = await removeFromEbay(sku, offerId)
  return NextResponse.json(result)
}