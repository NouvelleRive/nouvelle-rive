// src/components/Navbar.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { auth } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'

export default function Navbar() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user?.email === 'nouvelleriveparis@gmail.com')
    })
    return () => unsubscribe()
  }, [])

  const links = [
    { href: '/formulaire', label: 'Ajouter' },
    { href: '/mes-produits', label: 'Mes produits' },
    { href: '/mes-ventes', label: 'Mes ventes' },
    { href: '/profil', label: 'Profil' },
  ]

  if (isAdmin) {
    links.push({ href: '/admin', label: '🔧 Admin' })
  }

  return (
    <nav className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-[#22209C]">
          NOUVELLE RIVE
        </Link>
        <div className="flex space-x-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium ${
                pathname === link.href
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