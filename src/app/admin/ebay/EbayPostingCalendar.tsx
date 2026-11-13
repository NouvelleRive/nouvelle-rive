// app/admin/ebay/EbayPostingCalendar.tsx
'use client'

import { formatPrixEuro } from '@/lib/formatPrix'

/**
 * Pièces prévues sur eBay : toutes les pièces postables, dans l'ordre où le robot
 * les publie (les plus chères d'abord), 4 par jour à 10h, 13h, 16h et 19h — une à la fois,
 * jamais en masse (cf. restriction de juillet 2026).
 * Robot : cron pingEbaySync → /api/cron/sync-ebay-luxe?tous=1&max=1.
 */

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']
const CRENEAUX = [10, 13, 16, 19]
const AFFICHES = 30

type Candidat = {
  id: string
  nom: string
  marque: string
  prix: number | null
  sku: string
  image: string | null
}

// Date/heure prévue de la i-ème pièce de la file (0 = prochaine).
function creneau(i: number): string {
  const now = new Date()
  const restantsAujourdhui = CRENEAUX.filter(h => h > now.getHours()).length
  let jour: number, h: number
  if (i < restantsAujourdhui) {
    jour = 0
    h = CRENEAUX[CRENEAUX.length - restantsAujourdhui + i]
  } else {
    const k = i - restantsAujourdhui
    jour = 1 + Math.floor(k / CRENEAUX.length)
    h = CRENEAUX[k % CRENEAUX.length]
  }
  const d = new Date(now)
  d.setDate(now.getDate() + jour)
  const label = jour === 0 ? "Auj." : jour === 1 ? 'Demain' : `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`
  return `${label} ${h}h`
}

export default function EbayPostingCalendar({ candidats = [] }: { candidats?: Candidat[] }) {
  const jours = Math.ceil(candidats.length / CRENEAUX.length)
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="font-bold text-sm">📅 Pièces prévues</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Le robot publie 4 pièces luxe par jour (marque luxe ou prix ≥ 450 €), une à la fois : 10h, 13h, 16h et 19h. Les plus chères d&apos;abord.
          </p>
        </div>
        <p className="text-xs text-gray-600 text-right">
          <b>{candidats.length}</b> pièces postables · ~{jours} jours
        </p>
      </div>

      {candidats.length === 0 ? (
        <p className="text-xs text-gray-400">Aucune pièce postable en attente.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {candidats.slice(0, AFFICHES).map((c, i) => (
            <div key={c.id} className="border rounded-md overflow-hidden bg-white">
              <div className="relative aspect-square bg-gray-100">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.nom} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">—</div>
                )}
                <span className="absolute top-1 left-1 text-[9px] bg-black/60 text-white px-1 rounded">{creneau(i)}</span>
              </div>
              <div className="p-1.5">
                <p className="text-[10px] font-medium truncate">{c.sku} · {c.nom}</p>
                <p className="text-[10px] text-gray-500 flex justify-between gap-1">
                  <span className="truncate">{c.marque || '—'}</span>
                  <b className="text-gray-700">{c.prix != null ? formatPrixEuro(c.prix) : '—'}</b>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {candidats.length > AFFICHES && (
        <p className="text-[11px] text-gray-400 mt-2">+ {candidats.length - AFFICHES} autres ensuite.</p>
      )}
    </div>
  )
}
