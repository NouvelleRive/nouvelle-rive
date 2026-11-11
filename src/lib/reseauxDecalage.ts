import { adminDb } from '@/lib/firebaseAdmin'
import { FieldPath } from 'firebase-admin/firestore'

// Pause d'une chronique = file d'attente décalée, jamais de contenu perdu.
// À la réactivation, les contenus non publiés tombés pendant la pause
// reprennent dans l'ordre sur les prochaines dates de la chronique, et ceux
// déjà programmés après glissent d'autant de semaines.

const COLL = 'reseauxContenu'

const CHRONIQUE_DAY: Record<string, number> = {
  'infinite-slider': 0,
  'compo-de-lo': 1,
  'book-olga': 2,
  'couleurs-celeste': 3,
  'microboutique-hina': 4,
  'fond-blanc': 4,
  'shabbat-quote': 5,
  'energies-sarah': 6,
}

export function parisTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

// Contenu prêt, jamais publié, pas en échec de publication → déplaçable.
function movable(p: any): boolean {
  if (p.publishedAt || p.status === 'error') return false
  return p.format === 'publi' ? Array.isArray(p.medias) && p.medias.length > 0 : !!p.videoUrl
}

export async function decalerChronique(chronique: string, depuis: string): Promise<{ moved: number }> {
  const wd = CHRONIQUE_DAY[chronique]
  if (wd === undefined) return { moved: 0 }
  const today = parisTodayIso()

  const snap = await adminDb.collection(COLL)
    .where(FieldPath.documentId(), '>=', `${chronique}_`)
    .where(FieldPath.documentId(), '<', `${chronique}_`)
    .limit(200)
    .get()
  const docs = snap.docs
    .map((d) => ({ id: d.id, date: d.id.slice(chronique.length + 1), data: d.data() }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))

  const stale = docs.filter((d) => d.date >= depuis && d.date < today && movable(d.data))
  if (!stale.length) return { moved: 0 }

  const queue = [...stale, ...docs.filter((d) => d.date >= today && movable(d.data))]
    .sort((a, b) => a.date.localeCompare(b.date))
  // Créneaux à ne pas écraser : publiés, en erreur, ou brouillons sans média.
  const blocked = new Set(docs.filter((d) => d.date >= today && !movable(d.data)).map((d) => d.date))
  const todayHasContent = queue.some((d) => d.date === today)

  let slot = addDays(today, (wd - weekday(today) + 7) % 7)
  if (slot === today && !todayHasContent) slot = addDays(slot, 7)

  const moves: { from: string; to: string; data: any }[] = []
  for (const d of queue) {
    while (blocked.has(slot)) slot = addDays(slot, 7)
    moves.push({ from: d.id, to: `${chronique}_${slot}`, data: d.data })
    slot = addDays(slot, 7)
  }

  const targets = new Set(moves.map((m) => m.to))
  const batch = adminDb.batch()
  for (const m of moves) {
    if (m.from === m.to) continue
    batch.set(adminDb.collection(COLL).doc(m.to), { ...m.data, date: m.to.slice(chronique.length + 1) })
    if (!targets.has(m.from)) batch.delete(adminDb.collection(COLL).doc(m.from))
  }
  await batch.commit()
  return { moved: moves.filter((m) => m.from !== m.to).length }
}
