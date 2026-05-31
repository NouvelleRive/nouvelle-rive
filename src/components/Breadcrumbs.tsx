'use client'

import Link from 'next/link'
import { useLang, t } from '@/lib/i18n'
import { getTypeShortLabel } from '@/lib/typeLabels'

type Crumb = { label: string; href?: string }

export default function Breadcrumbs({
  typeSlug,
  marque,
  nom,
}: {
  typeSlug?: string
  marque?: string
  nom?: string
}) {
  const lang = useLang()

  const crumbs: Crumb[] = [{ label: t('Accueil', 'Home', lang), href: '/' }]

  if (typeSlug) {
    crumbs.push({
      label: getTypeShortLabel(typeSlug, lang),
      href: `/${typeSlug}`,
    })
  }
  if (marque) {
    crumbs.push({ label: marque })
  }
  if (nom) {
    crumbs.push({ label: nom })
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4"
      style={{
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: '11px',
        letterSpacing: '0.05em',
        color: '#666',
      }}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <li key={i} className="flex items-center gap-1.5">
              {c.href && !isLast ? (
                <Link
                  href={c.href}
                  className="hover:underline hover:text-black transition"
                  style={{ color: 'inherit' }}
                >
                  {c.label}
                </Link>
              ) : (
                <span style={{ color: '#000' }}>{c.label}</span>
              )}
              {!isLast && <span style={{ color: '#bbb' }}>›</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
