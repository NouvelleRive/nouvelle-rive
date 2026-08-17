// app/api/reseaux/weekfav-photos/route.ts
// Photos fond blanc des pièces mises en « week fav » par l'équipe cette semaine
// (favoriEquipe == true). Sert à composer un post carrousel dans New contenu.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

// Nettoie un handle IG (retire l'URL, le @, les paramètres).
function cleanHandle(v: string): string {
  return (v || '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .trim()
}

export async function GET() {
  try {
    // Map trigramme (majuscule) → handle IG, pour co-poster la chineuse du SKU.
    const chSnap = await adminDb.collection('chineuse').get()
    const trigToIg: { tri: string; ig: string }[] = chSnap.docs
      .map((d) => ({ tri: (d.data().trigramme || '').toString().trim().toUpperCase(), ig: cleanHandle(d.data().instagram || '') }))
      .filter((x) => x.tri && x.ig && /^[a-zA-Z0-9._]+$/.test(x.ig))
      .sort((a, b) => b.tri.length - a.tri.length) // longest-match d'abord (MAK avant MA)
    const igForSku = (sku: string): string => {
      const prefix = (sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase()
      if (!prefix) return ''
      return trigToIg.find((x) => prefix.startsWith(x.tri))?.ig || ''
    }

    const snap = await adminDb.collection('produits').where('favoriEquipe', '==', true).limit(200).get()
    // Semaine glissante : 14 derniers jours (semaine en cours + précédente),
    // pour ne jamais tomber à vide en début de semaine.
    const windowStart = Date.now() - 14 * 24 * 3600 * 1000
    const ms = (raw: any) =>
      raw.favoriEquipeAt?.toMillis?.() ??
      (typeof raw.favoriEquipeAt?._seconds === 'number' ? raw.favoriEquipeAt._seconds * 1000 : 0)

    const items = snap.docs
      .map((d) => ({ id: d.id, raw: d.data() as any }))
      .filter(({ raw }) =>
        ms(raw) >= windowStart &&
        raw.statut !== 'supprime' && raw.statut !== 'retour' &&
        raw.vendu !== true && raw.hidden !== true &&
        (raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl))
      .sort((a, b) => ms(b.raw) - ms(a.raw))
      .map(({ id, raw }) => ({
        sku: raw.sku || id,
        nom: raw.nom || '',
        // Priorité au fond blanc (photos.face), sinon la photo principale.
        photo: raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl || '',
        chineuse: igForSku(raw.sku || id),
      }))

    // Handles IG uniques des chineuses des pièces → co-post.
    const chineuses = [...new Set(items.map((it) => it.chineuse).filter(Boolean))]

    return NextResponse.json({ success: true, items, chineuses })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
