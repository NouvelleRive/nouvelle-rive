'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import Link from 'next/link'
import { db } from '@/lib/firebaseConfig'
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore'

type Etapes = { profil: boolean; contrat: boolean; validee: boolean; pieces: boolean; rdv: boolean }
type EtapesContextType = Etapes & { refreshEtapes: () => void; setEtape: (key: keyof Etapes, value: boolean) => void }
export const EtapesContext = createContext<EtapesContextType>({ profil: false, contrat: false, validee: false, pieces: false, rdv: false, refreshEtapes: () => {}, setEtape: () => {} })
export const useEtapes = () => useContext(EtapesContext)

function ProgressBar({ etapes }: { etapes: Etapes }) {
  const pathname = usePathname()
  const steps = [
    { label: 'Profil & contrat', href: '/deposante/profil', done: etapes.profil && etapes.contrat, matches: ['/deposante/profil'] },
    { label: 'Mes pièces', href: '/deposante/formulaire', done: etapes.pieces, matches: ['/deposante/formulaire', '/deposante/mes-produits'] },
    { label: 'RDV', href: '/deposante/calendrier', done: etapes.rdv, matches: ['/deposante/calendrier'] },
  ]
  return (
    <div className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center">
        {steps.map((step, i) => {
          const prev = i === 0 ? true : steps[i - 1].done
          const current = step.matches.some(p => pathname?.startsWith(p))
          return (
            <div key={step.label} className="flex items-center">
              <Link
                href={prev ? step.href : '#'}
                className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest px-3 py-1 ${
                  step.done ? 'text-[#22209C]' : current ? 'text-[#22209C]' : prev ? 'text-gray-400 hover:text-[#22209C]' : 'text-gray-300 pointer-events-none'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] border ${
                  step.done ? 'bg-[#22209C] border-[#22209C] text-white' : current ? 'bg-white border-[#22209C] text-[#22209C]' : 'border-gray-300 text-gray-300'
                }`}>
                  {step.done ? '✓' : i + 1}
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
  const etapes = useEtapes()

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const links = [
    { href: '/deposante/formulaire', label: 'Ajouter une pièce', locked: false },
    { href: '/deposante/mes-produits', label: 'Mes pièces', locked: false },
    { href: '/deposante/mes-ventes', label: 'Mes ventes', locked: false },
    { href: '/deposante/profil', label: 'Mon profil', locked: false },
    { href: '/deposante/calendrier', label: 'Calendrier', locked: !etapes.pieces },
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
              href={link.locked ? '#' : link.href}
              onClick={link.locked ? (e) => e.preventDefault() : undefined}
              aria-disabled={link.locked || undefined}
              title={link.locked ? 'Ajoutez d\'abord une pièce pour débloquer cet onglet' : undefined}
              className={`text-sm font-medium transition-colors ${
                link.locked
                  ? 'text-gray-300 cursor-not-allowed pointer-events-none'
                  : isActive(link.href)
                    ? 'text-[#22209C] underline'
                    : 'text-gray-600 hover:text-[#22209C]'
              }`}
            >
              {link.locked && '🔒 '}{link.label}
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
              href={link.locked ? '#' : link.href}
              onClick={link.locked ? (e) => e.preventDefault() : undefined}
              aria-disabled={link.locked || undefined}
              className={`text-sm font-medium py-2 transition-colors ${
                link.locked
                  ? 'text-gray-300 cursor-not-allowed pointer-events-none'
                  : isActive(link.href)
                    ? 'text-[#22209C] font-semibold'
                    : 'text-gray-600'
              }`}
            >
              {link.locked && '🔒 '}{link.label}
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
  const [etapes, setEtapes] = useState<Etapes>({ profil: false, contrat: false, validee: false, pieces: false, rdv: false })
  const [showWelcome, setShowWelcome] = useState(false)

  const loadEtapes = async (u: User) => {
    try {
      // Read direct par doc(uid) — plus fiable que la where(authUid)
      let d: any = null
      const directSnap = await getDoc(doc(db, 'deposante', u.uid))
      if (directSnap.exists()) {
        d = directSnap.data()
      } else {
        const fallback = await getDocs(query(collection(db, 'deposante'), where('authUid', '==', u.uid)))
        if (!fallback.empty) d = fallback.docs[0].data()
      }
      if (d) {
        const profilOk = !!(d.prenom && d.nom && d.adresse1 && d.telephone && d.iban && d.pieceIdentiteUrl)
        const contratOk = !!d.contratSigne
        const valideeOk = !!d.validee
        const prodSnap = await getDocs(query(collection(db, 'produits'), where('chineur', '==', u.email)))
        const piecesOk = prodSnap.size > 0
        const restockSnap = await getDocs(collection(db, 'restocks'))
        let rdvOk = false
        restockSnap.docs.forEach(doc => {
          Object.values(doc.data()).forEach((slot: any) => {
            if (slot?.nom === (d.trigramme || '').toUpperCase()) rdvOk = true
          })
        })
        setEtapes({ profil: profilOk, contrat: contratOk, validee: valideeOk, pieces: piecesOk, rdv: rdvOk })
        if (!d.hasSeenWelcome) setShowWelcome(true)
      } else {
        setShowWelcome(true)
      }
    } catch (e) {
      console.error('Erreur layout deposante', e)
      setShowWelcome(true)
    }
  }

  const refreshEtapes = () => {
    if (user) loadEtapes(user)
  }

  const setEtape = (key: keyof Etapes, value: boolean) => {
    setEtapes(prev => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/client/login'); return }
      setUser(u)
      await loadEtapes(u)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  // Listener temps réel sur le doc deposante pour détecter contratSigne automatiquement
  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(doc(db, 'deposante', user.uid), (snap) => {
      if (!snap.exists()) return
      const d = snap.data() as any
      const profilOk = !!(d.prenom && d.nom && d.adresse1 && d.telephone && d.iban && d.pieceIdentiteUrl)
      const contratOk = !!d.contratSigne
      const valideeOk = !!d.validee
      setEtapes(prev => ({ ...prev, profil: profilOk, contrat: contratOk, validee: valideeOk }))
    })
    return () => unsub()
  }, [user])

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
    <EtapesContext.Provider value={{ ...etapes, refreshEtapes, setEtape }}>
    <div className="min-h-screen bg-gray-50">
      <DeposanteNavbar />
      <ProgressBar etapes={etapes} />
      {showWelcome && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-sm w-full p-8" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            <h2 className="text-xl font-bold mb-6">Bienvenue 👋</h2>
            <ol className="space-y-3 text-sm text-gray-800 mb-8">
              <li>1. Complétez votre profil et signez votre contrat</li>
              <li>2. Ajoutez vos pièces</li>
              <li>3. Prenez rendez-vous pour les déposer en boutique</li>
            </ol>
            <button onClick={dismissWelcome} className="w-full py-3 text-white text-xs font-semibold uppercase tracking-widest" style={{ backgroundColor: '#22209C' }}>
              Commencer →
            </button>
          </div>
        </div>
      )}
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {children}
      </main>
    </div>
    </EtapesContext.Provider>
  )
}