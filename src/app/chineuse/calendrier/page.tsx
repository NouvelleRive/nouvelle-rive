'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import PlanningCalendar from '@/components/PlanningCalendar'

export default function ChineuseCalendrierPage() {
  const [userNom, setUserNom] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return
      const snap = await getDocs(query(collection(db, 'chineuse'), where('email', '==', user.email)))
      if (!snap.empty) {
        const data = snap.docs[0].data()
        setUserNom((data.nom || data.trigramme || '').toUpperCase())
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
    </div>
  )

  return (
    <PlanningCalendar
      mode="restock"
      participants={userNom ? [{ nom: userNom, type: 'chineuse' }] : []}
      userType="chineuse"
      userNom={userNom}
    />
  )
}