// app/api/reseaux/weekfav-photos/route.ts
// Photos fond blanc des pièces mises en « week fav » par l'équipe cette semaine
// (favoriEquipe == true). Sert à composer un post carrousel dans New contenu.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

// Début (lundi 00:00 Paris) de la semaine en cours, en ms epoch.
function startOfThisWeekMs(): number {
  const now = new Date()
  const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const day = (paris.getDay() + 6) % 7 // 0 = lundi
  paris.setHours(0, 0, 0, 0)
  paris.setDate(paris.getDate() - day)
  const offset = now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' })).getTime()
  return paris.getTime() + offset
}

export async function GET() {
  try {
    const snap = await adminDb.collection('produits').where('favoriEquipe', '==', true).limit(200).get()
    const thisWeekStart = startOfThisWeekMs()
    const prevWeekStart = thisWeekStart - 7 * 24 * 3600 * 1000
    const ms = (raw: any) =>
      raw.favoriEquipeAt?.toMillis?.() ??
      (typeof raw.favoriEquipeAt?._seconds === 'number' ? raw.favoriEquipeAt._seconds * 1000 : 0)

    const dispo = snap.docs
      .map((d) => ({ id: d.id, raw: d.data() as any }))
      .filter(({ raw }) =>
        raw.statut !== 'supprime' && raw.statut !== 'retour' &&
        raw.vendu !== true && raw.hidden !== true &&
        (raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl))

    // Semaine en cours ; si vide (début de semaine), on retombe sur la précédente.
    let chosen = dispo.filter(({ raw }) => ms(raw) >= thisWeekStart)
    let semaine: 'courante' | 'precedente' = 'courante'
    if (chosen.length === 0) {
      chosen = dispo.filter(({ raw }) => ms(raw) >= prevWeekStart && ms(raw) < thisWeekStart)
      semaine = 'precedente'
    }

    const items = chosen
      .sort((a, b) => ms(b.raw) - ms(a.raw))
      .map(({ id, raw }) => ({
        sku: raw.sku || id,
        nom: raw.nom || '',
        // Priorité au fond blanc (photos.face), sinon la photo principale.
        photo: raw.photos?.face || raw.imageUrls?.[0] || raw.imageUrl || '',
      }))

    return NextResponse.json({ success: true, items, semaine })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
