// app/admin/layout.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import { AdminProvider, useAdmin } from '@/lib/admin/context'
import Link from 'next/link'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

// =====================
// NAVBAR COMPONENT
// =====================
function AdminNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { selectedChineuse, setSelectedChineuse, chineusesList, produitsFiltres } = useAdmin()
  const [menuOpen, setMenuOpen] = useState(false)

  const [equipeOpen, setEquipeOpen] = useState(false)
const equipeRef = useRef<HTMLDivElement>(null)

// Fermer dropdown Équipe au clic extérieur
useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (equipeRef.current && !equipeRef.current.contains(e.target as Node)) {
      setEquipeOpen(false)
    }
  }
  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [])

  // Fermer le menu quand on change de page
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Stats rapides
  const stats = {
    total: produitsFiltres.filter(p => p.statut !== 'supprime' && p.statut !== 'retour' && !p.vendu && (p.quantite ?? 1) > 0).length,
    vendus: produitsFiltres.filter(p => p.vendu || (p.quantite ?? 1) <= 0).length,
  }

  const tabs = [
    { key: 'ajouter', label: 'Ajouter', href: '/admin/ajouter-produits' },  
    { key: 'produits', label: 'Produits', href: '/admin/nos-produits' },
    { key: 'ventes', label: 'Ventes', href: '/admin/nos-ventes' },
    { key: 'commandes', label: 'Commandes', href: '/admin/nos-commandes' },
    { key: 'perf', label: 'Perf', href: '/admin/performance', adminOnly: true },
    { key: 'site', label: 'Site', href: '/admin/site', adminOnly: true },
    { key: 'inventaire', label: 'Inventaire', href: '/admin/inventaires', adminOnly: true },
    { key: 'clients', label: 'Clientes', href: '/admin/clientes' },
    ]

  // Filtrer les tabs admin-only si chineuse sélectionnée
  const visibleTabs = tabs.filter(tab => !tab.adminOnly || !selectedChineuse)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const getTabClassName = (active: boolean) =>
    active ? 'text-[#22209C] underline' : 'text-gray-600 hover:text-[#22209C]'

  return (
    <>
      <nav className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/admin" className="text-lg font-bold text-[#22209C] uppercase tracking-wider">
              Nouvelle Rive
            </Link>

            {/* Tabs Desktop */}
            <div className="hidden lg:flex items-center space-x-6">
  {visibleTabs.map((tab) => {
    const active = isActive(tab.href)
    return (
      <Link 
        key={tab.key} 
        href={tab.href} 
        className={`text-sm font-medium transition-all ${getTabClassName(tab, active)}`}
      >
        {tab.label}
      </Link>
    )
  })}

  {/* Dropdown Équipe */}
  {!selectedChineuse && (
    <div ref={equipeRef} className="relative">
      <button
        onClick={() => setEquipeOpen(!equipeOpen)}
        className={`text-sm font-medium transition-all flex items-center gap-1 ${
          isActive('/admin/deposantes') || isActive('/admin/vendeuses')
            ? 'text-[#22209C] underline'
            : 'text-gray-600 hover:text-[#22209C]'
        }`}
      >
        Équipe
        <svg className={`w-3 h-3 transition-transform ${equipeOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {equipeOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-lg py-1 min-w-[160px] z-50">
          <Link
            href="/admin/deposantes"
            onClick={() => setEquipeOpen(false)}
            className={`block px-4 py-2 text-sm transition-colors ${
              isActive('/admin/deposantes') ? 'text-[#22209C] font-semibold bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Création
          </Link>
          <Link
            href="/admin/vendeuses"
            onClick={() => setEquipeOpen(false)}
            className={`block px-4 py-2 text-sm transition-colors ${
              isActive('/admin/vendeuses') ? 'text-[#22209C] font-semibold bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Vente
          </Link>
        </div>
      )}
    </div>
  )}
</div>

            {/* Filtre "Je suis" - Desktop */}
            <div className="hidden lg:flex items-center gap-3">
              <span className="text-sm text-gray-500">Je suis</span>
              <select
                value={selectedChineuse?.uid || ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setSelectedChineuse(null)
                  } else {
                    const chineuse = chineusesList.find(c => c.uid === e.target.value)
                    if (chineuse) {
                      setSelectedChineuse(chineuse)
                      if (pathname.includes('/admin/ebay')) {
                        router.push('/admin/nos-produits')
                      }
                    }
                  }
                }}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium bg-white min-w-[200px]"
              >
                <option value="">NOUVELLE RIVE</option>
                {chineusesList.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {(c.nom || c.email?.split('@')[0] || '').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Hamburger Mobile */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden flex flex-col justify-center items-center w-8 h-8"
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
        </div>

        {/* Menu Mobile Dropdown */}
        <div 
          className="lg:hidden overflow-hidden transition-all duration-300 ease-in-out border-t"
          style={{
            maxHeight: menuOpen ? '500px' : '0',
            opacity: menuOpen ? 1 : 0,
            borderTopColor: menuOpen ? '#e5e7eb' : 'transparent'
          }}
        >
          <div className="px-4 py-3 flex flex-col space-y-2 bg-white">
            {/* Filtre "Je suis" - Mobile */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
              <span className="text-sm text-gray-500">Je suis</span>
              <select
                value={selectedChineuse?.uid || ''}
                onChange={(e) => {
                  if (e.target.value === '') {
                    setSelectedChineuse(null)
                  } else {
                    const chineuse = chineusesList.find(c => c.uid === e.target.value)
                    if (chineuse) {
                      setSelectedChineuse(chineuse)
                      if (pathname.includes('/admin/ebay')) {
                        router.push('/admin/nos-produits')
                      }
                    }
                  }
                }}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium bg-white flex-1"
              >
                <option value="">NOUVELLE RIVE</option>
                {chineusesList.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {(c.nom || c.email?.split('@')[0] || '').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Tabs Mobile */}
            {visibleTabs.map((tab) => {
              const active = isActive(tab.href)
              return (
                <Link 
                  key={tab.key} 
                  href={tab.href} 
                  className={`text-sm font-medium py-2 transition-all ${getTabClassName(tab, active)}`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
      
      {/* Stats bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedChineuse?.trigramme && (
                <span className="text-xs text-gray-500 border px-2 py-1 rounded bg-gray-50">
                  {selectedChineuse.trigramme}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Produits:</span>
                <span className="font-bold">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Vendus:</span>
                <span className="font-bold text-green-600">{stats.vendus}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// =====================
// LAYOUT WRAPPER
// =====================
function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push('/login')
        return
      }
      // Vérifier si admin
      if (u.email !== ADMIN_EMAIL) {
        router.push('/')
        return
      }
      setUser(u)
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar />
      <main className="max-w-7xl mx-auto p-4 lg:p-6">
        {children}
      </main>
    </div>
  )
}

// =====================
// EXPORT
// =====================
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminProvider>
  )
}