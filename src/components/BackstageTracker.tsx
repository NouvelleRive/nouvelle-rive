'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackPage } from '@/lib/backstage'

function Inner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    trackPage(pathname)
    // searchParams sert seulement à re-déclencher sur un changement de query
  }, [pathname, searchParams])

  return null
}

export default function BackstageTracker() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  )
}
