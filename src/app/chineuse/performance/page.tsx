// app/chineuse/performance/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, User } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import PerformanceContent from '@/components/PerformanceContent'

export default function ChineusePerformancePage() {
  const router = useRouter()
  const [trigramme, setTrigramme] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) {
        router.push('/login')
        return
      }
      try {
        const snap = await getDocs(
          query(collection(db, 'chineuse'), where('email', '==', u.email))
        )
        if (!snap.empty) {
          const data = snap.docs[0].data()
          setTrigramme(data.trigramme || '')
        }
      } catch (err) {
        console.error('Erreur chargement chineuse:', err)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  if (!trigramme) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-400 text-sm">Profil chineuse introuvable</p>
      </div>
    )
  }

  return <PerformanceContent role="chineuse" chineuseTrigramme={trigramme} />
}