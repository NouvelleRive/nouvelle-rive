// app/acheteuse/calendrier/page.tsx
// RDV dépôt de l'acheteuse : mêmes créneaux que chineuses + déposantes (week-end
// inclus), SAUF les jours de présence de Sarah (dérivés du calendrier vendeuse).
'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import PlanningCalendar from '@/components/PlanningCalendar'
import { ADMIN_EMAIL, ACHETEUSE_EMAIL, ACHETEUSE_TRIGRAMME } from '@/lib/roles'
import { useRouter } from 'next/navigation'

// Vendeuse dont la présence bloque les RDV de l'acheteuse.
const VENDEUSE_BLOQUANTE = 'Sarah'
const ACHETEUSE_NOM = 'ACHETEUSE'

export default function AcheteuseCalendrierPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push('/login'); return }
      if (u.email !== ACHETEUSE_EMAIL && u.email !== ADMIN_EMAIL) { router.push('/app'); return }
      setReady(true)
    })
    return () => unsub()
  }, [router])

  if (!ready) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-xl font-bold text-[#22209C]">RDV DÉPÔT</h1>
        <p className="text-sm text-gray-500">Choisis un créneau libre. Les jours de {VENDEUSE_BLOQUANTE} ne sont pas proposés.</p>
      </div>
      <PlanningCalendar
        mode="restock"
        participants={[{ nom: ACHETEUSE_NOM, type: 'chineuse', trigramme: ACHETEUSE_TRIGRAMME }]}
        userType="acheteuse"
        userNom={ACHETEUSE_NOM}
        blockVendeusePrenom={VENDEUSE_BLOQUANTE}
      />
    </div>
  )
}
