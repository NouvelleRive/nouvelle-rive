'use client'
import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth, db } from '@/lib/firebaseConfig'
import { collection, getDocs, Timestamp } from 'firebase/firestore'
import Navbar from '@/components/Navbar'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

type Produit = {
  id: string
  nom: string
  chineur?: string
  categorie?: any
  prix?: number
  quantite?: number
  createdAt?: Timestamp
}

export default function AdminProduitsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User|null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [produits, setProduits] = useState<Produit[]>([])
  const [filtreEmail, setFiltreEmail] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/login'); return }
      setUser(u)
      const tokenRes = await u.getIdTokenResult()
      const admin = !!tokenRes.claims?.admin
      setIsAdmin(admin)
      if (!admin) { router.push('/mes-produits'); return }

      const snap = await getDocs(collection(db, 'produits'))
      setProduits(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Produit[])
    })
    return () => unsub()
  }, [router])

  const chineuses = useMemo(() => {
    return Array.from(new Set(produits.map(p => p.chineur).filter(Boolean))) as string[]
  }, [produits])

  const list = useMemo(() => {
    return produits.filter(p => !filtreEmail || p.chineur === filtreEmail)
  }, [produits, filtreEmail])

  if (!user || !isAdmin) return null

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Admin — Tous les produits</h1>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Filtrer par chineuse (email)</label>
          <select
            value={filtreEmail}
            onChange={e=>setFiltreEmail(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">Toutes</option>
            {chineuses.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="space-y-3">
          {list.map(p => (
            <div key={p.id} className="border rounded p-3">
              <div className="font-semibold">{p.nom}</div>
              <div className="text-sm text-gray-600">{p.chineur || '—'}</div>
              <div className="text-sm">Qté: {p.quantite ?? 1} — Prix: {p.prix ?? '—'} €</div>
              <div className="text-xs text-gray-500">
                Ajouté le{' '}
                {p.createdAt instanceof Timestamp ? format(p.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : '—'}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
