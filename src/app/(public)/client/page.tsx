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
        <div className="flex gap-12 items-stretch">
        <div className="flex-1">
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
        <div className="w-64 shrink-0" style={{ backgroundColor: '#22209C' }}>
          <div className="p-6">
            <h2 className="text-lg font-bold uppercase mb-1 text-white">Vendre chez</h2>
            <h2 className="text-lg font-bold uppercase mb-6 text-white">NOUVELLE RIVE</h2>
            <div className="space-y-3">
              <Link
                href="/client/deposant/inscription"
                className="block p-3 border border-white text-white text-sm hover:bg-white hover:text-black transition-colors"
              >
                Je suis un particulier
              </Link>
              <Link
                href="/client/pro/inscription"
                className="block p-3 border border-white text-white text-sm hover:bg-white hover:text-black transition-colors"
              >
                Je suis un professionnel
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}