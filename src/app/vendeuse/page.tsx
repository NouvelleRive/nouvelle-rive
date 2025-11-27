// app/vendeuse/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function VendeusePage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/vendeuse/commandes')
  }, [router])

  return null
}