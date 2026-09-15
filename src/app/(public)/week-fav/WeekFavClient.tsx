'use client'

import ProductGrid from '@/components/ProductGrid'
import { useLang, t } from '@/lib/i18n'
import type { WeekFavGroup } from '@/lib/produitsServer'

// Lundi 00h de la semaine en cours (heure locale du visiteur), pour repérer
// la section « Cette semaine ».
function startOfThisWeekLocal(): number {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // 0 = lundi
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d.getTime()
}

function weekLabel(weekStart: number, lang: 'fr' | 'en'): string {
  const d = new Date(weekStart)
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  return t(`Semaine du ${date}`, `Week of ${date}`, lang)
}

export default function WeekFavClient({ groups = [] }: { groups?: WeekFavGroup[] }) {
  const lang = useLang()
  const thisWeek = startOfThisWeekLocal()

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="px-6 py-20">
        <h1
          id="titre"
          style={{
            fontSize: 'clamp(40px, 8vw, 120px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 0.9,
            textTransform: 'uppercase',
          }}
        >
          {t('Week fav', 'Week fav', lang)}
        </h1>
      </div>
      <div className="w-full border-t border-black" />

      {groups.length === 0 ? (
        <div className="py-20 text-center">
          <p
            className="uppercase tracking-widest text-gray-400"
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px' }}
          >
            {t('Aucune pièce pour le moment', 'No pieces yet', lang)}
          </p>
        </div>
      ) : (
        groups.map(({ weekStart, produits }) => (
          <section key={weekStart}>
            <div className="px-6 pt-14 pb-6">
              <h2
                className="uppercase tracking-widest text-gray-500"
                style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '12px' }}
              >
                {weekStart >= thisWeek
                  ? t('Cette semaine', 'This week', lang)
                  : weekLabel(weekStart, lang)}
              </h2>
            </div>
            <ProductGrid produits={produits as any} columns={3} />
          </section>
        ))
      )}
    </div>
  )
}
