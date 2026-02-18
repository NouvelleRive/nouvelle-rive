'use client'

import { useAdmin } from '@/lib/admin/context'
import PerformanceContent from '@/components/PerformanceContent'

export default function AdminPerformancePage() {
  const { selectedChineuse } = useAdmin()

  return (
    <PerformanceContent
      role={selectedChineuse ? 'chineuse' : 'admin'}
      chineuseTrigramme={selectedChineuse?.trigramme || undefined}
    />
  )
}