// app/client/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'

export default function ClientPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/client/login')
        return
      }
      setUser(currentUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold uppercase mb-8">MON COMPTE</h1>
        
        <p className="mb-8">Bonjour, {user?.displayName || user?.email}</p>

        <div className="space-y-4">
          <Link 
            href="/client/profil" 
            className="block p-4 border border-black hover:bg-gray-50"
          >
            Mon profil
          </Link>
          
          <Link 
            href="/client/commande" 
            className="block p-4 border border-black hover:bg-gray-50"
          >
            Mes commandes
          </Link>
          
          <Link 
            href="/client/favoris" 
            className="block p-4 border border-black hover:bg-gray-50"
          >
            Mes favoris
          </Link>
          
          <button
            onClick={handleLogout}
            className="w-full p-4 border border-black hover:bg-black hover:text-white transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}