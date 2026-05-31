'use client'

import { useLang } from '@/lib/i18n'

export default function TypeH1Title({ fr, en }: { fr: string; en: string }) {
  const lang = useLang()
  return (
    <h1
      style={{
        fontSize: 'clamp(40px, 8vw, 120px)',
        fontWeight: 700,
        letterSpacing: '-0.03em',
        lineHeight: 0.9,
        textTransform: 'uppercase',
      }}
    >
      {lang === 'en' ? en : fr}
    </h1>
  )
}
