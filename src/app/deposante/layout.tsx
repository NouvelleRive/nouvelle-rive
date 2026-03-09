'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import Link from 'next/link'
import { db } from '@/lib/firebaseConfig'
import { collection, query, where, getDocs } from 'firebase/firestore'

type Etapes = { profil: boolean; contrat: boolean; pieces: boolean; rdv: boolean }

function ProgressBar({ etapes }: { etapes: Etapes }) {
  const steps = [
    { key: 'profil', label: 'Profil', href: '/deposante/profil' },
    { key: 'contrat', label: 'Contrat', href: '/deposante/profil' },
    { key: 'pieces', label: 'Mes pièces', href: '/deposante/mes-produits' },
    { key: 'rdv', label: 'RDV', href: '/deposante/calendrier' },
  ]
  return (
    <div className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center">
        {steps.map((step, i) => {
          const done = etapes[step.key as keyof Etapes]
          const prev = i === 0 ? true : etapes[steps[i - 1].key as keyof Etapes]
          return (
            <div key={step.key} className="flex items-center">
              <Link
                href={prev ? step.href : '#'}
                className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest px-3 py-1 ${
                  done ? 'text-[#22209C]' : prev ? 'text-gray-400 hover:text-[#22209C]' : 'text-gray-300 pointer-events-none'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] border ${
                  done ? 'bg-[#22209C] border-[#22209C] text-white' : 'border-gray-300 text-gray-300'
                }`}>
                  {done ? '✓' : i + 1}
                </span>
                {step.label}
              </Link>
              {i < steps.length - 1 && <span className="text-gray-200 mx-1">—</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeposanteNavbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const links = [
    { href: '/deposante/mes-produits', label: 'Mes produits' },
    { href: '/deposante/mes-ventes', label: 'Mes ventes' },
    { href: '/deposante/profil', label: 'Mon profil' },
    { href: '/deposante/calendrier', label: 'Calendrier' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/deposante/mes-produits" className="text-lg font-bold text-[#22209C] uppercase tracking-wider">
          Nouvelle Rive
        </Link>

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

      <div
        className="md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t"
        style={{ maxHeight: menuOpen ? '400px' : '0', opacity: menuOpen ? 1 : 0, borderTopColor: menuOpen ? '#e5e7eb' : 'transparent' }}
      >
        <div className="px-4 py-3 flex flex-col space-y-3 bg-white">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium py-2 transition-colors ${isActive(link.href) ? 'text-[#22209C] font-semibold' : 'text-gray-600'}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default function DeposanteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [etapes, setEtapes] = useState<Etapes>({ profil: false, contrat: false, pieces: false, rdv: false })
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/login'); return }
      setUser(u)
      const snap = await getDocs(query(collection(db, 'deposante'), where('authUid', '==', u.uid)))
      if (!snap.empty) {
        const d = snap.docs[0].data()
        const profilOk = !!(d.prenom && d.nom && d.adresse1 && d.telephone && d.iban && d.pieceIdentiteUrl)
        const contratOk = !!d.contratSigne
        const prodSnap = await getDocs(query(collection(db, 'produits'), where('chineur', '==', u.email)))
        const piecesOk = prodSnap.size > 0
        const restockSnap = await getDocs(collection(db, 'restocks'))
        let rdvOk = false
        restockSnap.docs.forEach(doc => {
          Object.values(doc.data()).forEach((slot: any) => {
            if (slot?.nom === (d.trigramme || '').toUpperCase()) rdvOk = true
          })
        })
        setEtapes({ profil: profilOk, contrat: contratOk, pieces: piecesOk, rdv: rdvOk })
        if (!d.hasSeenWelcome) setShowWelcome(true)
      } else {
        setShowWelcome(true)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
    </div>
  )
  if (!user) return null

  const dismissWelcome = async () => {
    setShowWelcome(false)
    const token = await auth.currentUser?.getIdToken()
    if (token) await fetch('/api/deposante', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ hasSeenWelcome: true }),
    })
    router.push('/deposante/profil')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DeposanteNavbar />
      <ProgressBar etapes={etapes} />
      {showWelcome && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-md w-full p-8" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#22209C] mb-4">Bienvenue chez Nouvelle Rive</p>
            <h2 className="text-2xl font-bold mb-4">Voici les étapes pour déposer vos pièces</h2>
            <ol className="space-y-3 text-sm text-gray-700 mb-8">
              <li className="flex gap-3"><span className="font-bold text-[#22209C]">1.</span> Complétez votre profil (identité, coordonnées bancaires, pièce d'identité)</li>
              <li className="flex gap-3"><span className="font-bold text-[#22209C]">2.</span> Signez votre contrat de dépôt-vente</li>
              <li className="flex gap-3"><span className="font-bold text-[#22209C]">3.</span> Ajoutez vos pièces (5 maximum)</li>
              <li className="flex gap-3"><span className="font-bold text-[#22209C]">4.</span> Prenez rendez-vous pour déposer vos articles en boutique</li>
            </ol>
            <button onClick={dismissWelcome} className="w-full py-3 text-white text-xs font-semibold uppercase tracking-widest" style={{ backgroundColor: '#22209C' }}>
              Commencer par mon profil →
            </button>
          </div>
        </div>
      )}
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}