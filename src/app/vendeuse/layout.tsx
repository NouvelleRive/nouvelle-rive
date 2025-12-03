// app/vendeuse/layout.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import Link from 'next/link'
import { ClipboardList, Package, Users, ShoppingBag } from 'lucide-react'

const VENDEUSE_EMAIL = 'nouvellerivecommandes@gmail.com'
const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

function VendeuseNavbar() {
  const pathname = usePathname()

  const links = [
    { href: '/vendeuse/commandes', label: 'Commandes', icon: ShoppingBag },
    { href: '/vendeuse/clientes', label: 'Clientes', icon: Users },
    { href: '/vendeuse/inventaire', label: 'Inventaire', icon: ClipboardList },
    { href: '/vendeuse/restock', label: 'RE/DEstock', icon: Package },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="hidden sm:flex items-center justify-between">
          <Link href="/vendeuse/commandes" className="text-lg font-bold text-[#22209C] uppercase tracking-wider">
            Nouvelle Rive
          </Link>
          <div className="flex space-x-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  isActive(link.href)
                    ? 'text-[#22209C] underline'
                    : 'text-gray-600 hover:text-[#22209C]'
                }`}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="sm:hidden">
          <div className="flex items-center justify-center mb-3">
            <Link href="/vendeuse/commandes" className="text-lg font-bold text-[#22209C] uppercase tracking-wider">
              Nouvelle Rive
            </Link>
          </div>
          <div className="flex justify-around">
            {links.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg transition-colors ${
                    isActive(link.href)
                      ? 'text-[#22209C] bg-[#22209C]/5'
                      : 'text-gray-500 hover:text-[#22209C]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[10px] font-medium">{link.label}</span>
                </Link>
              )
            })}
          </div>
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
      <main>
        {children}
      </main>
    </div>
  )
}