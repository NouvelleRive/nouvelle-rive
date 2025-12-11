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

      // Charger les infos chineuse depuis la RACINE du document (après migration)
      try {
        const deposantsSnap = await getDocs(
          query(collection(db, 'chineuse'), where('email', '==', u.email))
        )
        
        if (!deposantsSnap.empty) {
          const depData = deposantsSnap.docs[0].data()
          
          // ✅ Toutes les infos sont maintenant à la racine
          setChineuse({
            nom: depData.nom,
            siret: depData.siret,
            adresse1: depData.adresse1,
            adresse2: depData.adresse2,
            tva: depData.tva,
            iban: depData.iban,
            bic: depData.bic,
            banqueAdresse: depData.banqueAdresse,
            taux: depData.taux,
            codeChineuse: depData.trigramme,
          })
        }
      } catch (err) {
        console.error('Erreur chargement deposant:', err)
      }

      await fetchVentes(u.email!)
    })
    return () => unsub()
  }, [router])

  async function fetchVentes(email: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/ventes?chineurEmail=${encodeURIComponent(email)}`)
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

  const handleRefresh = async () => {
    if (user?.email) {
      await fetchVentes(user.email)
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
      onRefresh={handleRefresh}
    />
  )
}