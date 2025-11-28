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
  const [isVendeuse, setIsVendeuse] = useState(false)

  // ✅ Vérifier si l'utilisateur est admin ou vendeuse
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user?.email === 'nouvelleriveparis@gmail.com')
      setIsVendeuse(user?.email === 'nouvellerivecommandes@gmail.com')
    })
    return () => unsubscribe()
  }, [])

  const links = [
    { href: '/formulaire',   label: 'Ajouter un produit' },
    { href: '/mes-produits', label: 'Mes produits' },
    { href: '/mes-ventes',   label: 'Mes ventes' },
    { href: '/profil',       label: 'Mon profil' },
  ]

  // ✅ Ajouter Commandes pour admin ET vendeuse
  if (isAdmin || isVendeuse) {
    links.unshift({ href: '/admin/commandes', label: '📦 Commandes' })
  }

  // ✅ Ajouter Admin seulement pour admin
  if (isAdmin) {
    links.push({ href: '/admin', label: '🔧 Admin' })
  }

  return (
    <nav className="bg-white border-b" data-nav-version="v2">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">NOUVELLE RIVE</h1>
        <div className="flex space-x-6">
          {links.map((link) => {
            const active = pathname === link.href
            const cls = active
              ? 'text-primary underline'
              : 'text-gray-600 hover:text-primary'
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium ${cls}`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}