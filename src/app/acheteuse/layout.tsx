// app/acheteuse/layout.tsx
// Espace ACHETEUSE — même socle que l'espace chineuse, réservé à l'acheteuse
// (et à l'admin qui peut y entrer). Module découpable : toute la logique rôle
// vient de @/lib/roles.
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import Link from 'next/link'
import NotifsAutoSubscribe from '@/components/NotifsAutoSubscribe'
import LogoutButton from '@/components/LogoutButton'
import { ADMIN_EMAIL, ACHETEUSE_EMAIL, ACHETEUSE_CHINEUSE_DOC } from '@/lib/roles'

function AcheteuseNavbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const links = [
    { href: '/acheteuse/strategie', label: "Stratégie d'achat" },
    { href: '/acheteuse/formulaire', label: 'Ajouter un produit' },
    { href: '/acheteuse/mes-produits', label: 'Mes produits' },
    { href: '/acheteuse/calendrier', label: 'RDV dépôt' },
    { href: '/acheteuse/mes-ventes', label: 'Mes ventes' },
    { href: '/acheteuse/performance', label: 'Mes perf' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/acheteuse/mes-produits" className="text-lg font-bold text-[#22209C] uppercase tracking-wider">
            Nouvelle Rive
          </Link>
          <LogoutButton />
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex space-x-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                isActive(link.href) ? 'text-[#22209C] underline' : 'text-gray-600 hover:text-[#22209C]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Hamburger mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col justify-center items-center w-8 h-8"
          aria-label="Menu"
        >
          <span className="block w-6 h-0.5 bg-[#22209C] transition-all duration-300" style={{ transform: menuOpen ? 'rotate(45deg) translateY(6px)' : 'none' }} />
          <span className="block w-6 h-0.5 bg-[#22209C] my-1.5 transition-all duration-300" style={{ opacity: menuOpen ? 0 : 1 }} />
          <span className="block w-6 h-0.5 bg-[#22209C] transition-all duration-300" style={{ transform: menuOpen ? 'rotate(-45deg) translateY(-6px)' : 'none' }} />
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className="md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t"
        style={{ maxHeight: menuOpen ? '400px' : '0', opacity: menuOpen ? 1 : 0, borderTopColor: menuOpen ? '#e5e7eb' : 'transparent' }}
      >
        <div className="px-4 py-3 flex flex-col space-y-3 bg-white">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium py-2 transition-colors ${
                isActive(link.href) ? 'text-[#22209C] font-semibold' : 'text-gray-600'
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

export default function AcheteuseLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push('/login'); return }
      // Accès réservé acheteuse + admin ; les autres repartent vers /app
      if (u.email !== ACHETEUSE_EMAIL && u.email !== ADMIN_EMAIL) {
        router.push('/app')
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
      <NotifsAutoSubscribe ownerId={ACHETEUSE_CHINEUSE_DOC} />
      <AcheteuseNavbar />
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}
