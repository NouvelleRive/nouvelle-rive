import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { adminDb } from '@/lib/firebaseAdmin'

// Contenu programmé (non encore publié) sur les prochaines dates, toutes chroniques.
// Sert à l'aperçu Feed : ces posts s'affichent au-dessus des vrais posts.
// Server-side, léger. Trié par date DESC (le plus lointain d'abord = simulation IG).

const COLL = 'reseauxContenu'
const CHRONIQUE_DAY: Record<string, number> = {
  'infinite-slider': 0,
  'compo-de-lo': 1,
  'book-olga': 2,
  'le-rideau': 3,
  'microboutique-hina': 4,
  'fond-blanc': 4,
  'shabbat-quote': 5,
  'energies-sarah': 6,
}
const NB_OCCURRENCES = 12 // ~3 mois affichés

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function upcomingDates(weekday: number, count: number): string[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const delta = (weekday - today.getDay() + 7) % 7
  const first = new Date(today)
  first.setDate(today.getDate() + delta)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(first)
    d.setDate(first.getDate() + i * 7)
    out.push(toISO(d))
  }
  return out
}

export async function GET() {
  try {
    const keys = Object.keys(CHRONIQUE_DAY)
    const refsByKey = keys.map((k) => upcomingDates(CHRONIQUE_DAY[k], NB_OCCURRENCES).map((d) => adminDb.collection(COLL).doc(`${k}_${d}`)))
    const flat = refsByKey.flat()
    const snaps = await adminDb.getAll(...flat)

    const planned = snaps
      .filter((s) => {
        if (!s.exists) return false
        const d = s.data() as any
        const firstMedia = Array.isArray(d.medias) && d.medias[0] ? d.medias[0].url : ''
        return (d.vignetteUrl || d.videoUrl || firstMedia) && d.status !== 'published'
      })
      .map((s) => {
        const d = s.data() as any
        const firstMedia = Array.isArray(d.medias) && d.medias[0] ? d.medias[0] : null
        return {
          date: d.date,
          chronique: d.chronique,
          vignetteUrl: d.vignetteUrl || (firstMedia && firstMedia.type === 'image' ? firstMedia.url : ''),
          videoUrl: d.videoUrl || (firstMedia && firstMedia.type === 'video' ? firstMedia.url : ''),
          offsetY: typeof d.vignetteOffsetY === 'number' ? d.vignetteOffsetY : 50,
        }
      })
      // Ordre de publication : le plus lointain en premier (haut de grille façon IG)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

    return NextResponse.json(
      { success: true, planned },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
