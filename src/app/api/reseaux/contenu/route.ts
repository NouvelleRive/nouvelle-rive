import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

// Productions des chroniques réseaux.
// 1 doc par (chronique, date de passage) : id déterministe `${chronique}_${date}`.
// GET  ?chronique=key  → renvoie les productions à venir (dates calculées + docs existants)
// POST { chronique, date, ...champs } → upsert d'une production

const COLL = 'reseauxContenu'

// weekday getDay() de chaque chronique — doit rester aligné avec la page.
const CHRONIQUE_DAY: Record<string, number> = {
  'infinite-slider': 0,
  'compo-de-lo': 1,
  'book-olga': 2,
  'le-rideau': 3,
  'microboutique-hina': 4,
  'shabbat-quote': 5,
  'energies-sarah': 6,
}

const NB_OCCURRENCES = 6 // ~6 semaines d'avance affichées

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Prochaines dates (aujourd'hui inclus) pour un jour de semaine donné.
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

export async function GET(req: NextRequest) {
  try {
    const chronique = req.nextUrl.searchParams.get('chronique') || ''
    const weekday = CHRONIQUE_DAY[chronique]
    if (weekday === undefined) {
      return NextResponse.json({ success: false, error: 'chronique inconnue' }, { status: 400 })
    }

    const dates = upcomingDates(weekday, NB_OCCURRENCES)
    const refs = dates.map((d) => adminDb.collection(COLL).doc(`${chronique}_${d}`))
    const snaps = await adminDb.getAll(...refs)

    const productions = dates.map((date, i) => {
      const s = snaps[i]
      const data = s.exists ? (s.data() as any) : {}
      return {
        date,
        theme: data.theme || '',
        objectif: data.objectif || '',
        format: data.format || '',
        videoUrl: data.videoUrl || '',
        vignetteUrl: data.vignetteUrl || '',
        medias: Array.isArray(data.medias) ? data.medias : [],
        caption: data.caption || '',
        heurePost: data.heurePost || '',
        cta: data.cta || '',
        lieu: data.lieu || 'Rue des Écouffes - le Marais',
        collab: data.collab || '',
        status: data.status || '',
        pret: data.format === 'publi' ? (Array.isArray(data.medias) && data.medias.length > 0) : !!data.videoUrl,
      }
    })

    return NextResponse.json({ success: true, productions })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { chronique, date } = body
    if (!chronique || !date || CHRONIQUE_DAY[chronique] === undefined) {
      return NextResponse.json({ success: false, error: 'chronique/date requis' }, { status: 400 })
    }

    const payload = {
      chronique,
      date,
      theme: body.theme ?? '',
      objectif: body.objectif ?? '',
      format: body.format ?? 'reel',
      videoUrl: body.videoUrl ?? '',
      vignetteUrl: body.vignetteUrl ?? '',
      medias: Array.isArray(body.medias) ? body.medias : [],
      caption: body.caption ?? '',
      heurePost: body.heurePost ?? '',
      cta: body.cta ?? '',
      lieu: body.lieu ?? 'Rue des Écouffes - le Marais',
      collab: body.collab ?? '',
      updatedAt: Date.now(),
    }

    await adminDb.collection(COLL).doc(`${chronique}_${date}`).set(payload, { merge: true })
    return NextResponse.json({ success: true, pret: !!payload.videoUrl })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}

// Supprime une production (le slot redevient vide).
export async function DELETE(req: NextRequest) {
  try {
    const { chronique, date } = await req.json()
    if (!chronique || !date) {
      return NextResponse.json({ success: false, error: 'chronique/date requis' }, { status: 400 })
    }
    await adminDb.collection(COLL).doc(`${chronique}_${date}`).delete()
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
