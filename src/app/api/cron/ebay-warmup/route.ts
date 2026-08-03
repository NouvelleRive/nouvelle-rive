// app/api/cron/ebay-warmup/route.ts
// Publication de CHAUFFE eBay — compte fraîchement débloqué (restriction 10 j
// de juillet 2026 après un publish en masse). On remonte le compte en douceur :
//   - vague 1 : Strass Chronique (SKU STRC…) — sacs, pas de taille, ~140-160 €
//   - vague 2 : lunettes MAKI (SKU MAK…, cf. resolveTrigramme / stock "MAK - Lunettes")
// AUCUN produit luxe ici : le luxe (sync-ebay-luxe) reste éteint tant que la
// chauffe n'est pas finie. Mix auto selon le nb en ligne (?strc=N&maki=M pour override).
// La file se vide toute seule : dès qu'une pièce est publiée elle a un
// ebayListingId et n'est plus resélectionnée le lendemain.
//
// Auth : header `Authorization: Bearer ${CRON_SECRET}`.
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { getChineusesLiteCached } from '@/lib/getChineusesLiteCached'
import { getAllProduitsCached } from '@/lib/getAllProduitsCached'
import {
  publishToEbay,
  prepareProductForEbay,
  wearTypeToGender,
  isEbayConfigured,
  getAccessToken,
  type EbayGender,
} from '@/lib/ebay'

const CRON_SECRET = process.env.CRON_SECRET

// Ordre des vagues de chauffe : préfixe SKU -> priorité (plus petit = posté en premier)
const WAVES: { prefix: string; label: string }[] = [
  { prefix: 'STRC', label: 'Strass Chronique' },
  { prefix: 'MAK', label: 'MAKI (lunettes)' },
]

function waveIndex(sku: string): number {
  const s = (sku || '').toUpperCase()
  const i = WAVES.findIndex(w => s.startsWith(w.prefix))
  return i === -1 ? Infinity : i
}

function waveKey(sku: string): 'STRC' | 'MAK' | null {
  const s = (sku || '').toUpperCase()
  if (s.startsWith('STRC')) return 'STRC'
  if (s.startsWith('MAK')) return 'MAK'
  return null
}

// Montée en charge pilotée par le nombre de STRC/MAKI DÉJÀ en ligne (pas par des
// dates). On passe à la phase suivante dès qu'on a assez de pièces publiées.
// luxe = nb de pièces luxe à publier ce jour-là (via sync-ebay-luxe, géré par le cron).
type Phase = { minOnline: number; strc: number; maki: number; luxe: number; label: string }
const PHASES: Phase[] = [
  { minOnline: 0,  strc: 3, maki: 0, luxe: 0, label: 'chauffe' },
  { minOnline: 9,  strc: 2, maki: 1, luxe: 0, label: 'STRC+MAKI' },
  { minOnline: 21, strc: 1, maki: 2, luxe: 0, label: 'MAKI+' },
  { minOnline: 36, strc: 0, maki: 2, luxe: 1, label: 'MAKI+luxe' },
]

function phaseForOnline(n: number): Phase {
  let chosen = PHASES[0]
  for (const p of PHASES) if (n >= p.minOnline) chosen = p
  return chosen
}

// Visible / postable : mêmes garde-fous que le site, sans contrainte de prix.
function isPostable(p: any): boolean {
  if (p.ebayListingId) return false
  if (p.vendu === true) return false
  if ((p.quantite ?? 1) <= 0) return false
  if (p.statut === 'retour' || p.statut === 'supprime') return false
  if (p.statutRecuperation) return false
  if (p.recu === false) return false
  if (p.hidden === true) return false
  if (p.forceDisplay === false) return false
  const hasImage = (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) || p.imageUrl
  if (!hasImage) return false
  return true
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!isEbayConfigured()) {
    return NextResponse.json({ success: false, error: 'ebay-non-configure' }, { status: 500 })
  }

  // Si l'auth eBay est KO (compte encore restreint), on abort sans rien toucher :
  // la file reste intacte et repartira au prochain passage.
  try {
    await getAccessToken()
  } catch (e: any) {
    return NextResponse.json({ success: false, error: 'ebay-auth-failed', detail: e?.message }, { status: 502 })
  }

  const { searchParams } = new URL(req.url)
  // Override manuel possible (?strc=2&maki=1) ; sinon phase auto selon le nb en ligne.
  const strcParam = searchParams.get('strc')
  const makiParam = searchParams.get('maki')

  const [chineusesLite, allProduits] = await Promise.all([
    getChineusesLiteCached(),
    getAllProduitsCached(),
  ])
  const wearTypeByTri = new Map<string, string>()
  for (const c of chineusesLite) {
    if (c.trigramme) wearTypeByTri.set(c.trigramme.toUpperCase(), c.wearType || 'womenswear')
  }

  const resolveGender = (p: any): EbayGender | undefined => {
    // STRC (Strass Chronique) et MAKI (lunettes) : toujours en femme.
    const sku = (p.sku || '').toUpperCase()
    if (sku.startsWith('STRC') || sku.startsWith('MAK')) return 'women'
    if (p.gender === 'women' || p.gender === 'men') return p.gender
    const trigramme = (p.chineuse || p.trigramme || (p.sku ? p.sku.match(/^([A-Z]{2,4})/i)?.[1] : null) || '').toString().toUpperCase()
    const wearType = trigramme ? wearTypeByTri.get(trigramme) : undefined
    return wearTypeToGender(wearType) || undefined
  }

  const produits = allProduits.map(({ id, raw }) => ({ id, ...(raw as any) }))

  // Nb de STRC/MAKI DÉJÀ en ligne → détermine la phase de la rampe.
  const online = produits.filter(p => waveKey(p.sku) && p.ebayListingId).length
  const phase = phaseForOnline(online)

  // Quotas du jour : override manuel si fourni, sinon phase auto.
  const quotas: Record<string, number> = {
    STRC: strcParam != null ? Math.max(0, parseInt(strcParam, 10) || 0) : phase.strc,
    MAK: makiParam != null ? Math.max(0, parseInt(makiParam, 10) || 0) : phase.maki,
  }

  // Candidats postables, pas encore en ligne. Tri : STRC avant MAKI, puis prix croissant.
  const candidats = produits
    .filter(p => waveKey(p.sku) && isPostable(p))
    .sort((a, b) => {
      const wa = waveIndex(a.sku), wb = waveIndex(b.sku)
      if (wa !== wb) return wa - wb
      return (a.prix ?? 0) - (b.prix ?? 0)
    })

  const published: Array<{ sku: string; listingId?: string; error?: string }> = []
  const sansGenre: string[] = []
  const done: Record<string, number> = { STRC: 0, MAK: 0 }

  for (const p of candidats) {
    const key = waveKey(p.sku)!
    if (done[key] >= quotas[key]) continue
    if (done.STRC >= quotas.STRC && done.MAK >= quotas.MAK) break
    const sku = p.sku || p.id
    // Sans genre eBay refuse (GENDER_REQUIRED) : on écarte sans consommer le quota.
    if (!resolveGender(p)) { sansGenre.push(sku); continue }
    try {
      const ebayProduct = prepareProductForEbay(p, resolveGender(p))
      if (ebayProduct.imageUrls.length === 0) { published.push({ sku, error: 'no-image' }); continue }
      const result = await publishToEbay(ebayProduct)
      if (result.success) {
        await adminDb.collection('produits').doc(p.id).update({
          ebayListingId: result.listingId,
          ebayOfferId: result.offerId,
          ebayPublishedAt: new Date().toISOString(),
          publishedOn: Array.from(new Set([...(p.publishedOn || []), 'ebay'])),
        })
        published.push({ sku, listingId: result.listingId })
        done[key]++
      } else {
        published.push({ sku, error: result.error })
      }
    } catch (e: any) {
      published.push({ sku, error: e?.message || 'erreur' })
    }
  }

  return NextResponse.json({
    success: true,
    phase: phase.label,
    online,
    quotas,
    luxeToday: phase.luxe,
    counts: {
      candidatsRestants: candidats.length,
      publishedOk: published.filter(x => x.listingId).length,
      publishedAttempted: published.length,
      skippedSansGenre: sansGenre.length,
    },
    published,
    sansGenre,
  })
}
