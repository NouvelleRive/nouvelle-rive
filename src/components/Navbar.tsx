// src/components/Navbar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

  const links = [
    { href: '/formulaire',   label: 'Ajouter un produit' },
    { href: '/mes-produits', label: 'Mes produits' },
    { href: '/mes-ventes',   label: 'Mes ventes' },
    { href: '/profil',       label: 'Mon profil' },
  ]

  return (
    <nav className="bg-white border-b" data-nav-version="v2">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Nouvelle Rive</h1>
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
