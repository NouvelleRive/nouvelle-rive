// app/mes-ventes/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
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

      // Charger les infos depuis deposants (contient le taux)
      try {
        const deposantsSnap = await getDocs(
          query(collection(db, 'chineuse'), where('email', '==', u.email))
        )
        
        if (!deposantsSnap.empty) {
          const depData = deposantsSnap.docs[0].data()
          const catRapport = (depData['Catégorie de rapport'] || [])[0] || {}
          
          setChineuse({
            nom: depData.nom,
            siret: catRapport.siret,
            adresse1: catRapport.adresse1,
            adresse2: catRapport.adresse2,
            tva: catRapport.tva,
            iban: catRapport.iban,
            bic: catRapport.bic,
            banqueAdresse: catRapport.banqueAdresse,
            taux: catRapport.taux,
            codeChineuse: depData.trigramme,
          })
        }
      } catch (err) {
        console.error('Erreur chargement deposant:', err)
      }

      // Charger les ventes via l'API
      await fetchVentes(u.uid)
    })
    return () => unsub()
  }, [router])

  // ✅ Même source que l'admin, filtrée par chineurUid
  async function fetchVentes(uid: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/ventes?chineurUid=${uid}`)
      const data = await res.json()
      if (data.success) {
        setVentes(data.ventes || [])
      }
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
        await fetchVentes(user.uid)
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