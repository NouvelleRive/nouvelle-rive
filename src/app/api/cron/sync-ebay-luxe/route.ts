// app/api/cron/sync-ebay-luxe/route.ts
// Synchronise les produits visibles sur la page LUXE avec eBay :
// - publie ceux qui matchent les règles luxe et ne sont pas encore sur eBay
// - retire ceux qui sont sur eBay mais ne devraient plus y être
//   (vendu / repris / supprimé / stock 0 / hors règles luxe)
//
// Auth : header `Authorization: Bearer ${CRON_SECRET}` (cron-job.org ou autre).
// Limite par défaut 10 publish + 10 remove par invocation pour éviter les timeouts ;
// override via ?max=N (utile en dev).
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebaseAdmin'
import {
  publishToEbay,
  prepareProductForEbay,
  removeFromEbay,
  wearTypeToGender,
  isEbayConfigured,
  getAccessToken,
  type EbayGender,
} from '@/lib/ebay'

const CRON_SECRET = process.env.CRON_SECRET

type Critere = { type: 'categorie' | 'nom' | 'description' | 'marque' | 'chineuse'; valeur: string }
type Regle = { id: string; criteres: Critere[] }
type LuxeConfig = { regles: Regle[]; prixMin?: number; prixMax?: number; joursRecents?: number }
type Chineuse = { uid: string; nom?: string; trigramme?: string; email?: string; wearType?: string }

function matchCritere(p: any, critere: Critere, chineuses: Chineuse[]): boolean {
  if (!critere.valeur) return true
  const valeurLower = critere.valeur.toLowerCase()
  switch (critere.type) {
    case 'categorie': {
      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      return (cat || '').toLowerCase().includes(valeurLower)
    }
    case 'nom':
      return (p.nom || '').toLowerCase().includes(valeurLower)
    case 'description':
      return (p.description || '').toLowerCase().includes(valeurLower)
    case 'marque':
      return (p.marque || '').toLowerCase().includes(valeurLower)
    case 'chineuse': {
      const chineuse = chineuses.find(c => c.uid === critere.valeur)
      if (!chineuse) return false
      if (p.chineur === chineuse.email) return true
      if (p.chineurUid === chineuse.uid) return true
      const trigramme = chineuse.trigramme?.toUpperCase() || '???'
      const skuUpper = p.sku?.toUpperCase() || ''
      return skuUpper.startsWith(trigramme) && (skuUpper.length === trigramme.length || /\d/.test(skuUpper[trigramme.length]))
    }
    default:
      return false
  }
}

function matchRegle(p: any, regle: Regle, chineuses: Chineuse[]): boolean {
  if (regle.criteres.length === 0) return false
  return regle.criteres.every(c => matchCritere(p, c, chineuses))
}

// Reproduction du filtre site (cf. siteConfig.getFilteredProducts).
function isVisibleOnSite(p: any, config: LuxeConfig): boolean {
  if (p.vendu === true) return false
  const quantite = p.quantite ?? 1
  if (quantite <= 0) return false
  if (p.statut === 'retour' || p.statut === 'supprime') return false
  if (p.recu === false) return false
  if (p.hidden === true) return false
  if (p.forceDisplay === false) return false
  const hasImage = (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) || p.imageUrl
  if (!hasImage) return false
  if (config.prixMin && p.prix < config.prixMin) return false
  if (config.prixMax && p.prix > config.prixMax) return false
  if (config.joursRecents && p.createdAt) {
    const created = p.createdAt instanceof Timestamp ? p.createdAt.toDate() : new Date(p.createdAt)
    const days = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)
    if (days > config.joursRecents) return false
  }
  return true
}

function matchesLuxeRules(p: any, config: LuxeConfig, chineuses: Chineuse[]): boolean {
  if (config.regles.length === 0) return true
  return config.regles.some(r => matchRegle(p, r, chineuses))
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!isEbayConfigured()) {
    return NextResponse.json({ success: false, error: 'ebay-non-configure' }, { status: 500 })
  }

  // Vérifie l'auth eBay au démarrage : si KO, on abort sans rien modifier.
  try {
    await getAccessToken()
  } catch (e: any) {
    return NextResponse.json({ success: false, error: 'ebay-auth-failed', detail: e?.message }, { status: 502 })
  }

  const { searchParams } = new URL(req.url)
  const max = Math.max(1, parseInt(searchParams.get('max') || '10', 10))

  const configSnap = await adminDb.collection('siteConfig').doc('luxe').get()
  const config: LuxeConfig = configSnap.exists ? { regles: [], ...configSnap.data() } as LuxeConfig : { regles: [] }

  const chineusesSnap = await adminDb.collection('chineuse').get()
  const chineuses: Chineuse[] = chineusesSnap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }))
  const wearTypeByTri = new Map<string, string>()
  for (const c of chineuses) if (c.trigramme) wearTypeByTri.set(c.trigramme.toUpperCase(), c.wearType || 'womenswear')

  const produitsSnap = await adminDb.collection('produits').get()
  const produits = produitsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))

  const toPublish: any[] = []
  const toRemove: any[] = []

  for (const p of produits) {
    const isOnEbay = !!p.ebayListingId
    const visible = isVisibleOnSite(p, config)
    const matchLuxe = visible && matchesLuxeRules(p, config, chineuses)

    if (matchLuxe && !isOnEbay) toPublish.push(p)
    else if (!matchLuxe && isOnEbay) toRemove.push(p)
  }

  const publishBatch = toPublish.slice(0, max)
  const removeBatch = toRemove.slice(0, max)

  const published: Array<{ sku: string; listingId?: string; error?: string }> = []
  const removed: Array<{ sku: string; ok: boolean; error?: string }> = []

  for (const p of publishBatch) {
    const sku = p.sku || p.id
    try {
      const trigramme = (p.chineuse || p.trigramme || (p.sku ? p.sku.match(/^([A-Z]{2,4})/i)?.[1] : null) || '').toString().toUpperCase()
      const wearType = trigramme ? wearTypeByTri.get(trigramme) : undefined
      const gender: EbayGender | undefined = wearTypeToGender(wearType) || undefined

      const ebayProduct = prepareProductForEbay(p, gender)
      if (ebayProduct.imageUrls.length === 0) {
        published.push({ sku, error: 'no-image' })
        continue
      }
      const result = await publishToEbay(ebayProduct)
      if (result.success) {
        await adminDb.collection('produits').doc(p.id).update({
          ebayListingId: result.listingId,
          ebayOfferId: result.offerId,
          ebayPublishedAt: new Date().toISOString(),
          publishedOn: Array.from(new Set([...(p.publishedOn || []), 'ebay'])),
        })
        published.push({ sku, listingId: result.listingId })
      } else {
        published.push({ sku, error: result.error })
      }
    } catch (e: any) {
      published.push({ sku, error: e?.message || 'erreur' })
    }
  }

  for (const p of removeBatch) {
    const sku = p.sku
    const offerId = p.ebayOfferId
    if (!sku) {
      removed.push({ sku: p.id, ok: false, error: 'no-sku' })
      continue
    }
    try {
      const result = await removeFromEbay(sku, offerId)
      if (!result.success) {
        removed.push({ sku, ok: false, error: result.error })
        continue
      }
      const newPublishedOn = Array.isArray(p.publishedOn) ? p.publishedOn.filter((s: string) => s !== 'ebay') : []
      await adminDb.collection('produits').doc(p.id).update({
        ebayListingId: null,
        ebayOfferId: null,
        ebayPublishedAt: null,
        publishedOn: newPublishedOn,
      })
      removed.push({ sku, ok: true })
    } catch (e: any) {
      removed.push({ sku, ok: false, error: e?.message || 'erreur' })
    }
  }

  return NextResponse.json({
    success: true,
    counts: {
      candidatesPublish: toPublish.length,
      candidatesRemove: toRemove.length,
      publishedAttempted: publishBatch.length,
      publishedOk: published.filter(x => x.listingId).length,
      removedOk: removed.filter(x => x.ok).length,
    },
    published,
    removed,
  })
}
