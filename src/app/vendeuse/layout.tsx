// app/vendeuse/layout.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import Link from 'next/link'

const VENDEUSE_EMAIL = 'nouvellerivecommandes@gmail.com'
const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

function VendeuseNavbar() {
  const pathname = usePathname()

  const links = [
    { href: '/vendeuse/commandes', label: 'Commandes' },
    { href: '/vendeuse/clientes', label: 'Fichier Clientes' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/vendeuse/commandes" className="text-lg font-bold text-[#22209C] uppercase tracking-wider">
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

export default function VendeuseLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push('/login')
        return
      }
      // Vérifier si vendeuse ou admin (admin peut aussi accéder)
      if (u.email !== VENDEUSE_EMAIL && u.email !== ADMIN_EMAIL) {
        router.push('/chineuse/mes-produits')
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
      <VendeuseNavbar />
      <main className="max-w-6xl mx-auto p-6">
        {children}
      </main>
    </div>
  )
}