'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/lib/firebaseConfig'
import PlanningCalendar from '@/components/PlanningCalendar'

export default function DeposanteCalendrierPage() {
  const [userNom, setUserNom] = useState<string>('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return
      const snap = await getDocs(query(collection(db, 'chineuse'), where('email', '==', user.email)))
      if (!snap.empty) {
        const data = snap.docs[0].data()
        setUserNom((data.nom || data.trigramme || '').toUpperCase())
      }
    })
    return () => unsub()
  }, [])

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <PlanningCalendar
        mode="restock"
        participants={userNom ? [{ nom: userNom, type: 'deposante' }] : []}
        userType="deposante"
        userNom={userNom}
      />
    </div>
  )
}