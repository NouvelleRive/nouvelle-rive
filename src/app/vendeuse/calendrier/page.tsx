'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import PlanningCalendar from '@/components/PlanningCalendar'

export default function VendeuseCalendrierPage() {
  const [participants, setParticipants] = useState<{ nom: string; type: 'chineuse' | 'deposante' }[]>([])

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'chineuse'))
      setParticipants(snap.docs.map(d => ({
        nom: ((d.data().nom || d.data().trigramme || '')).toUpperCase(),
        type: 'chineuse' as const
      })))
    }
    fetch()
  }, [])

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <PlanningCalendar
        mode="restock"
        participants={participants}
        userType="admin"
      />
    </div>
  )
}