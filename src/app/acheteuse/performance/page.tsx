// app/acheteuse/performance/page.tsx
// Perf de l'acheteuse : réutilise PerformanceContent filtré sur le trigramme ACH.
// La marge nette + la commission (Brique 4) s'affichent pour ce trigramme.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import PerformanceContent from '@/components/PerformanceContent'
import { ADMIN_EMAIL, ACHETEUSE_EMAIL, ACHETEUSE_TRIGRAMME } from '@/lib/roles'

export default function AcheteusePerformancePage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u: User | null) => {
      if (!u) { router.push('/login'); return }
      if (u.email !== ACHETEUSE_EMAIL && u.email !== ADMIN_EMAIL) { router.push('/app'); return }
      setReady(true)
    })
    return () => unsub()
  }, [router])

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  return <PerformanceContent role="chineuse" chineuseTrigramme={ACHETEUSE_TRIGRAMME} />
}
