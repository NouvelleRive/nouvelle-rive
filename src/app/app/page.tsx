'use client'

// Point d'entrée de l'app PWA installée (manifest start_url=/app).
// Dispatche vers la bonne page d'accueil selon le rôle de l'user connecté :
//   admin   → /admin/performance
//   vendeuse → /vendeuse/restock
//   chineuse → /chineuse/performance
//   non connecté → /login

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'
const VENDEUSE_EMAIL = 'nouvellerivecommandes@gmail.com'

export default function AppDispatchPage() {
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace('/login')
        return
      }
      if (u.email === ADMIN_EMAIL) router.replace('/admin/performance')
      else if (u.email === VENDEUSE_EMAIL) router.replace('/vendeuse/restock')
      else router.replace('/chineuse/performance')
    })
    return () => unsub()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
    </div>
  )
}
