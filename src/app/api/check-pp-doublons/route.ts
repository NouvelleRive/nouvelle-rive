// TEMPORAIRE — Doublons = même SKU vendu à <10 min d'écart
import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

const WINDOW_MS = 60 * 1000 // 60 secondes (même minute)

export async function GET() {
  try {
    const snap = await adminDb.collection('ventes').get()

    const ventes = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        sku: data.sku || 'SANS_SKU',
        nom: data.nom,
        trigramme: data.trigramme,
        prix: data.prixVenteReel,
        date: data.dateVente?.toDate?.() || null,
        paymentId: data.paymentId || null,
        orderId: data.orderId || null,
      }
    }).filter(v => v.date && v.sku !== 'SANS_SKU')

    // Grouper par SKU
    const bySku: Record<string, typeof ventes> = {}
    for (const v of ventes) {
      if (!bySku[v.sku]) bySku[v.sku] = []
      bySku[v.sku].push(v)
    }

    const doublons: any[] = []
    for (const [sku, list] of Object.entries(bySku)) {
      if (list.length < 2) continue
      list.sort((a, b) => (a.date!.getTime() - b.date!.getTime()))

      // Chercher les groupes de ventes avec écarts <= 10 min
      let i = 0
      while (i < list.length - 1) {
        const groupe = [list[i]]
        let j = i + 1
        while (j < list.length && (list[j].date!.getTime() - list[j-1].date!.getTime()) <= WINDOW_MS) {
          groupe.push(list[j])
          j++
        }
        if (groupe.length > 1) {
          doublons.push({
            sku,
            trigramme: groupe[0].trigramme,
            nom: groupe[0].nom,
            prix: groupe[0].prix,
            count: groupe.length,
            ventes: groupe.map(g => ({
              id: g.id,
              date: g.date!.toISOString(),
              prix: g.prix,
              paymentId: g.paymentId,
            })),
          })
        }
        i = j
      }
    }

    const byTrig: Record<string, number> = {}
    for (const d of doublons) {
      const t = d.trigramme || '?'
      byTrig[t] = (byTrig[t] || 0) + 1
    }

    return NextResponse.json({
      success: true,
      totalDoublons: doublons.length,
      totalVentesEnDoublon: doublons.reduce((s, d) => s + d.count, 0),
      parChineuse: byTrig,
      details: doublons,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
