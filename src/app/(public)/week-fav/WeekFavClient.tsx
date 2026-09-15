'use client'

import ProductGrid from '@/components/ProductGrid'
import { useLang, t } from '@/lib/i18n'
import type { WeekFavGroup } from '@/lib/produitsServer'

// Titre d'un bloc de semaine glissante (0 = 7 derniers jours).
function weekLabel(weeksAgo: number, lang: 'fr' | 'en'): string {
  if (weeksAgo === 0) return t('Cette semaine', 'This week', lang)
  if (weeksAgo === 1) return t('Semaine dernière', 'Last week', lang)
  return t(`Il y a ${weeksAgo} semaines`, `${weeksAgo} weeks ago`, lang)
}

export default function WeekFavClient({ groups = [] }: { groups?: WeekFavGroup[] }) {
  const lang = useLang()

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
        groups.map(({ weeksAgo, produits }) => (
          <section key={weeksAgo}>
            <div className="px-6 pt-14 pb-6">
              <h2
                className="uppercase tracking-widest text-gray-500"
                style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '12px' }}
              >
                {weekLabel(weeksAgo, lang)}
              </h2>
            </div>
            <ProductGrid produits={produits as any} columns={3} />
          </section>
        ))
      )}
    </div>
  )
}
