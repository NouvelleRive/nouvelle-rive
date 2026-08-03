// app/admin/ebay/EbayPostingCalendar.tsx
'use client'

/**
 * Calendrier de re-publication eBay.
 * Compte fraîchement débloqué → montée en charge progressive pour ne PAS
 * redéclencher une restriction (cf. ban 130 annonces du 21/07).
 * Le robot (cron sync-ebay-luxe) doit suivre ce rythme jour par jour.
 */

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']

type PhaseDef = {
  jusquA: number        // dernier jour (inclus) de la phase
  phase: string
  nb: number            // nb de pièces à poster ce jour
  type: string
  luxe: number          // nb de pièces luxe autorisées ce jour
  bg: string
  badge: string
}

// Rythme de sécurité sur 14 jours
const PHASES: PhaseDef[] = [
  { jusquA: 5,  phase: 'Chauffe',        nb: 3, luxe: 0, type: 'Non-luxe uniquement (< 150 €)',   bg: 'bg-green-50 border-green-200',  badge: 'bg-green-100 text-green-700' },
  { jusquA: 10, phase: 'Montée',         nb: 4, luxe: 0, type: 'Non-luxe + milieu de gamme',      bg: 'bg-blue-50 border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
  { jusquA: 14, phase: 'Intro luxe',     nb: 3, luxe: 1, type: '1 pièce luxe max + 2 non-luxe',    bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-800' },
]

function phasePourJour(n: number): PhaseDef {
  return PHASES.find(p => n <= p.jusquA) ?? PHASES[PHASES.length - 1]
}

type Candidat = {
  id: string
  nom: string
  marque: string
  prix: number | null
  sku: string
  image: string | null
  groupe: 'STRC' | 'MAKI'
}

export default function EbayPostingCalendar({
  nonLuxeDispo,
  luxeDispo,
  candidats = [],
  strcCount = 0,
  makiCount = 0,
}: {
  nonLuxeDispo: number
  luxeDispo: number
  candidats?: Candidat[]
  strcCount?: number
  makiCount?: number
}) {
  const today = new Date()

  const jours = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const ph = phasePourJour(i + 1)
    return {
      n: i + 1,
      label: `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`,
      isToday: i === 0,
      ph,
    }
  })

  const totalNonLuxe = jours.reduce((s, j) => s + (j.ph.nb - j.ph.luxe), 0)
  const totalLuxe = jours.reduce((s, j) => s + j.ph.luxe, 0)

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="font-bold text-sm flex items-center gap-2">
            📅 Calendrier de re-publication
            <span className="text-xs font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded">
              Compte en déblocage
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Montée en charge sur 14 jours pour éviter une nouvelle restriction. Le robot suit ce rythme.
          </p>
        </div>
        <div className="text-xs text-gray-600 text-right">
          <p>Stock prêt : <b>{nonLuxeDispo}</b> non-luxe · <b>{luxeDispo}</b> luxe</p>
          <p className="text-gray-400">Plan 14 j : {totalNonLuxe} non-luxe + {totalLuxe} luxe</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-7 gap-1.5">
        {jours.map((j) => (
          <div
            key={j.n}
            className={`border rounded-md p-2 text-center ${j.ph.bg} ${
              j.isToday ? 'ring-2 ring-[#22209C]' : ''
            }`}
          >
            <p className="text-[11px] font-medium text-gray-600 leading-tight">{j.label}</p>
            <p className="text-2xl font-bold text-gray-800 leading-none my-1">{j.ph.nb}</p>
            <p className="text-[10px] text-gray-500 leading-tight">
              {j.ph.luxe > 0 ? `dont ${j.ph.luxe} luxe` : 'non-luxe'}
            </p>
            <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded ${j.ph.badge}`}>
              {j.ph.phase}
            </span>
          </div>
        ))}
      </div>

      {/* Légende des phases */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-gray-600">
        {PHASES.map((p) => (
          <div key={p.phase} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${p.badge.split(' ')[0]}`} />
            <span><b>{p.phase}</b> — {p.type}</span>
          </div>
        ))}
      </div>

      {/* Pièces concrètes prévues pour la chauffe */}
      {candidats.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            Pièces prévues pour la chauffe{' '}
            <span className="font-normal text-gray-400">
              — {strcCount} Strass Chronique puis {makiCount} lunettes MAKI · 3/jour ({Math.ceil((strcCount + makiCount) / 3)} jours)
            </span>
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {candidats.map((c, i) => {
              const isStrc = c.groupe === 'STRC'
              const marque = c.marque || (isStrc ? 'Strass Chronique' : 'MAKI')
              return (
                <div key={c.id} className="border rounded-md overflow-hidden bg-white">
                  <div className="relative aspect-square bg-gray-100">
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt={c.nom} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">—</div>
                    )}
                    <span className="absolute top-1 left-1 text-[9px] bg-black/60 text-white px-1 rounded">J{Math.floor(i / 3) + 1}</span>
                    <span className={`absolute top-1 right-1 text-[9px] text-white px-1 rounded ${isStrc ? 'bg-pink-500' : 'bg-indigo-500'}`}>
                      {c.groupe}
                    </span>
                  </div>
                  <div className="p-1.5">
                    <p className="text-[10px] font-medium truncate">{c.nom}</p>
                    <p className="text-[10px] text-gray-500 flex justify-between">
                      <span className="truncate">{marque}</span>
                      <b className="text-gray-700">{c.prix != null ? `${c.prix}€` : '—'}</b>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(nonLuxeDispo < totalNonLuxe) && (
        <p className="mt-3 text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1.5">
          ⚠️ Stock non-luxe insuffisant pour tenir la phase de chauffe ({nonLuxeDispo} dispo / {totalNonLuxe} prévues).
          Ajoute des pièces &lt; 150 € (vêtements sans grande marque, accessoires) avant de lancer le robot.
        </p>
      )}
    </div>
  )
}
