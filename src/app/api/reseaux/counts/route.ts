import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { adminDb } from '@/lib/firebaseAdmin'

// Nombre de contenus prêts d'avance par chronique (vidéo présente sur les
// prochaines dates de passage). Server-side, caché 5 min. Gratuit.

const COLL = 'reseauxContenu'

const CHRONIQUE_DAY: Record<string, number> = {
  'infinite-slider': 0,
  'compo-de-lo': 1,
  'book-olga': 2,
  'le-rideau': 3,
  'microboutique-hina': 4,
  'shabbat-quote': 5,
  'energies-sarah': 6,
}

const NB_OCCURRENCES = 6

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
    // Un seul getAll pour toutes les chroniques (6 dates chacune).
    const refsByKey = keys.map((k) => upcomingDates(CHRONIQUE_DAY[k], NB_OCCURRENCES).map((d) => adminDb.collection(COLL).doc(`${k}_${d}`)))
    const flat = refsByKey.flat()
    const snaps = await adminDb.getAll(...flat)

    const counts: Record<string, number> = {}
    let idx = 0
    keys.forEach((k) => {
      let n = 0
      for (let i = 0; i < NB_OCCURRENCES; i++) {
        const s = snaps[idx++]
        const d = s.exists ? (s.data() as any) : null
        if (d && (d.videoUrl || (Array.isArray(d.medias) && d.medias.length > 0))) n++
      }
      counts[k] = n
    })

    return NextResponse.json(
      { success: true, counts },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=1800' } },
    )
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
