// app/vendeuse/layout.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/lib/firebaseConfig'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import Link from 'next/link'
import { ClipboardList, Package, ShoppingBag, Shirt, Calendar, Inbox } from 'lucide-react'
import NotifsAutoSubscribe from '@/components/NotifsAutoSubscribe'
import LogoutButton from '@/components/LogoutButton'

const VENDEUSE_EMAIL = 'nouvellerivecommandes@gmail.com'
const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

function VendeuseNavbar() {
  const pathname = usePathname()

  // Compteurs de notifs
  const [depotCount, setDepotCount] = useState(0)
  const [commandesCount, setCommandesCount] = useState(0)
  const [produitsCount, setProduitsCount] = useState(0)

  // Déposantes en attente de validation profil + RDV en attente (3 mois courants)
  useEffect(() => {
    let nbProfils = 0
    let nbRdvs = 0
    const update = () => setDepotCount(nbProfils + nbRdvs)

    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const monthKeys = new Set<string>()
    for (let i = 0; i < 3; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() + i, 1)
      monthKeys.add(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
    }

    const unsubDep = onSnapshot(collection(db, 'deposante'), (snap) => {
      nbProfils = snap.docs.filter(d => {
        const x = d.data() as any
        return x.contratSigne === true && !x.validee && !x.refusee
      }).length
      update()
    })
    const unsubRestocks = onSnapshot(collection(db, 'restocks'), (snap) => {
      let count = 0
      snap.docs.forEach(d => {
        if (!monthKeys.has(d.id)) return
        const slots = (d.data() as any).slots || {}
        Object.entries(slots).forEach(([key, slot]: [string, any]) => {
          if (!slot || slot.type !== 'deposante') return
          if (slot.acceptee === true || slot.refusee === true) return
          if ((key.split('_')[0] || '') < today) return
          count++
        })
      })
      nbRdvs = count
      update()
    })
    return () => { unsubDep(); unsubRestocks() }
  }, [])

  // Commandes non terminées : reste tant que ce n'est pas dans l'historique
  // (à préparer = payée + à poster = preparee)
  useEffect(() => {
    const q = query(collection(db, 'commandes'), where('statut', 'in', ['payée', 'preparee']))
    const unsub = onSnapshot(q, (snap) => setCommandesCount(snap.size))
    return () => unsub()
  }, [])

  // Produits déposante avec prix baissé auto, encore en stock (à pousser)
  useEffect(() => {
    const q = query(
      collection(db, 'produits'),
      where('source', '==', 'deposante'),
      where('vendu', '==', false),
      where('baisse20Done', '==', true),
    )
    const unsub = onSnapshot(q, (snap) => setProduitsCount(snap.size))
    return () => unsub()
  }, [])

  const links = useMemo(() => [
    { href: '/vendeuse/commandes', label: 'Commandes', icon: ShoppingBag, badge: commandesCount },
    { href: '/vendeuse/produits', label: 'Produits', icon: Shirt, badge: produitsCount },
    { href: '/vendeuse/calendrier', label: 'Calendrier', icon: Calendar, badge: 0 },
    { href: '/vendeuse/restock', label: 'RE/DEstock', icon: Package, badge: 0 },
    { href: '/vendeuse/demandes-depot', label: 'Dépôt', icon: Inbox, badge: depotCount },
  ], [commandesCount, depotCount, produitsCount])

  const isActive = (href: string) => pathname === href

  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/vendeuse/calendrier" className="text-lg font-bold text-[#22209C] uppercase tracking-wider">
              Nouvelle Rive
            </Link>
            <Link href="/vendeuse/inventaire" className="text-xs text-gray-400 hover:text-[#22209C] border border-gray-200 rounded px-2 py-1 flex items-center gap-1">
              <ClipboardList size={12} />
              Inventaire
            </Link>
            <LogoutButton />
          </div>
          <div className="flex space-x-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 relative ${
                  isActive(link.href)
                    ? 'text-[#22209C] underline'
                    : 'text-gray-600 hover:text-[#22209C]'
                }`}
              >
                <span className="relative">
                  <link.icon size={16} />
                  {link.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {link.badge}
                    </span>
                  )}
                </span>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="sm:hidden">
          <div className="flex items-center justify-center mb-3 gap-3">
            <Link href="/vendeuse/calendrier" className="text-lg font-bold text-[#22209C] uppercase tracking-wider">
              Nouvelle Rive
            </Link>
            <Link href="/vendeuse/inventaire" className="text-xs text-gray-400 hover:text-[#22209C] border border-gray-200 rounded px-2 py-1 flex items-center gap-1">
              <ClipboardList size={12} />
              Inventaire
            </Link>
            <LogoutButton />
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
                  <span className="relative">
                    <Icon size={20} />
                    {link.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {link.badge}
                      </span>
                    )}
                  </span>
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
      <NotifsAutoSubscribe ownerId="boutique" />
      <VendeuseNavbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}