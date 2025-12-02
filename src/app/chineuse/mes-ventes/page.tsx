// app/mes-ventes/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, getDoc, doc, query, where, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import SalesList, { Vente, ChineuseMeta } from '@/components/SalesList'

export default function MesVentesPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [ventes, setVentes] = useState<Vente[]>([])
  const [chineuse, setChineuse] = useState<ChineuseMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncLoading, setSyncLoading] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push('/login')
        return
      }
      setUser(u)

      // Charger les infos chineuse
      const chineuseSnap = await getDoc(doc(db, 'chineuse', u.uid))
      setChineuse(chineuseSnap.exists() ? (chineuseSnap.data() as ChineuseMeta) : null)

      // Charger les ventes
      await fetchVentes(u.uid, u.email!)
    })
    return () => unsub()
  }, [router])

  async function fetchVentes(uid: string, email: string) {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'produits'),
        where('chineur', '==', email),
        where('vendu', '==', true)
      )
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Vente[]
      setVentes(data)
    } catch (err) {
      console.error('Erreur chargement ventes:', err)
    } finally {
      setLoading(false)
    }
  }

  // Sync avec Square
  const handleSync = async (startDate: string, endDate: string) => {
    if (!user) return
    setSyncLoading(true)
    try {
      const res = await fetch('/api/sync-ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          chineurUid: user.uid
        })
      })
      const data = await res.json()
      if (data.success) {
        alert(`${data.imported || 0} vente(s) synchronisée(s)`)
        await fetchVentes(user.uid, user.email!)
      } else {
        alert(data.error || 'Erreur de synchronisation')
      }
    } catch (err) {
      console.error('Erreur sync:', err)
      alert('Erreur de synchronisation')
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <SalesList
      titre="MES VENTES CHEZ NOUVELLE RIVE"
      ventes={ventes}
      chineuse={chineuse}
      userEmail={user?.email || undefined}
      isAdmin={false}
      loading={loading}
      onSync={handleSync}
      syncLoading={syncLoading}
    />
  )
}