// app/chineuse/layout.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import Link from 'next/link'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'
const VENDEUSE_EMAIL = 'nouvellerivecommandes@gmail.com'

// Emails des animatrices ateliers - à ajuster selon vrais emails
const ANIMATRICES_EMAILS = [
  'ines@nouvellerive.fr',      // INES PINEAU
  'tetedorange@gmail.com',     // TÊTE D'ORANGE
  'archives@gmail.com',        // ARCHIVE.S
  'gigi@gigiparis.com',        // GIGI PARIS
]

function ChineuseNavbar() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isVendeuse, setIsVendeuse] = useState(false)
  const [isAnimatrice, setIsAnimatrice] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user?.email === ADMIN_EMAIL)
      setIsVendeuse(user?.email === VENDEUSE_EMAIL)
      setIsAnimatrice(ANIMATRICES_EMAILS.includes(user?.email || ''))
    })
    return () => unsubscribe()
  }, [])

  // Fermer le menu quand on change de page
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const links = [
    { href: '/chineuse/formulaire', label: 'Ajouter un produit' },
    { href: '/chineuse/mes-produits', label: 'Mes produits' },
    { href: '/chineuse/mes-ventes', label: 'Mes ventes' },
    { href: '/chineuse/profil', label: 'Mon profil' },
  ]

  // Ajouter Ateliers pour admin ET animatrices
  if (isAdmin || isAnimatrice) {
    links.push({ href: '/chineuse/ateliers', label: 'Ateliers' })
  }

  // Ajouter Commandes pour admin ET vendeuse
  if (isAdmin || isVendeuse) {
    links.unshift({ href: '/admin/nos-commandes', label: 'Commandes' })
  }

  // Ajouter Admin seulement pour admin
  if (isAdmin) {
    links.push({ href: '/admin/nos-produits', label: 'Admin' })
  }

  const isActive = (href: string) => pathname === href

  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/chineuse/mes-produits" className="text-lg font-bold text-[#22209C] uppercase tracking-wider">
          Nouvelle Rive
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex space-x-6">
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

        {/* Hamburger mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col justify-center items-center w-8 h-8"
          aria-label="Menu"
        >
          <span 
            className="block w-6 h-0.5 bg-[#22209C] transition-all duration-300"
            style={{
              transform: menuOpen ? 'rotate(45deg) translateY(6px)' : 'none'
            }}
          />
          <span 
            className="block w-6 h-0.5 bg-[#22209C] my-1.5 transition-all duration-300"
            style={{
              opacity: menuOpen ? 0 : 1
            }}
          />
          <span 
            className="block w-6 h-0.5 bg-[#22209C] transition-all duration-300"
            style={{
              transform: menuOpen ? 'rotate(-45deg) translateY(-6px)' : 'none'
            }}
          />
        </button>
      </div>

      {/* Mobile menu dropdown */}
      <div 
        className="md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t"
        style={{
          maxHeight: menuOpen ? '400px' : '0',
          opacity: menuOpen ? 1 : 0,
          borderTopColor: menuOpen ? '#e5e7eb' : 'transparent'
        }}
      >
        <div className="px-4 py-3 flex flex-col space-y-3 bg-white">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium py-2 transition-colors ${
                isActive(link.href)
                  ? 'text-[#22209C] font-semibold'
                  : 'text-gray-600'
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
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}