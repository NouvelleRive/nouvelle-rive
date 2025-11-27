// app/chineuse/layout.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import Link from 'next/link'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'
const VENDEUSE_EMAIL = 'nouvellerivecommandes@gmail.com'

function ChineuseNavbar() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isVendeuse, setIsVendeuse] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user?.email === ADMIN_EMAIL)
      setIsVendeuse(user?.email === VENDEUSE_EMAIL)
    })
    return () => unsubscribe()
  }, [])

  const links = [
    { href: '/chineuse/formulaire', label: 'Ajouter un produit' },
    { href: '/chineuse/mes-produits', label: 'Mes produits' },
    { href: '/chineuse/mes-ventes', label: 'Mes ventes' },
    { href: '/chineuse/profil', label: 'Mon profil' },
  ]

  // Ajouter Commandes pour admin ET vendeuse
  if (isAdmin || isVendeuse) {
    links.unshift({ href: '/admin/nos-commandes', label: '📦 Commandes' })
  }

  // Ajouter Admin seulement pour admin
  if (isAdmin) {
    links.push({ href: '/admin/nos-produits', label: '🔧 Admin' })
  }

  const isActive = (href: string) => pathname === href

  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/chineuse/mes-produits" className="text-lg font-bold text-[#22209C] uppercase tracking-wider">
          Nouvelle Rive
        </Link>
        <div className="flex space-x-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? 'text-[#22209C] underline'
                  : 'text-gray-600 hover:text-[#22209C]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default function ChineuseLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push('/login')
        return
      }
      setUser(u)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <ChineuseNavbar />
      <main className="max-w-6xl mx-auto p-6">
        {children}
      </main>
    </div>
  )
}