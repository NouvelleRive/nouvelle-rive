// app/api/produits/all/route.ts
// Route admin (nos-ventes). On passe par le cache serveur mutualisé
// getAllProduitsCached (unstable_cache 1h) au lieu d'un scan Firestore par appel.
export const runtime = 'nodejs'
export const revalidate = 3600

import { NextResponse } from 'next/server'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'

export async function GET() {
  try {
    const all = await getAllProduitsCached()

    const produits = all
      .filter(({ raw: d }) => !d.statutRecuperation)
      .map(({ id, raw: d }) => ({
        id,
        sku: d.sku || '',
        nom: d.nom || '',
        trigramme: d.trigramme || '',
        chineurUid: d.chineurUid || '',
        chineur: d.chineur || '',
        prix: d.prix || 0,
        quantite: d.quantite ?? 1,
        statut: d.statut || '',
        vendu: d.vendu || false,
      }))
      .filter(p => p.vendu !== true && p.quantite > 0 && p.statut !== 'supprime' && p.statut !== 'retour')
      .sort((a, b) => a.sku.localeCompare(b.sku))

    return NextResponse.json({ success: true, produits }, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (err: any) {
    console.error('[API PRODUITS ALL]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}