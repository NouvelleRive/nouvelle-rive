'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import SalesList, { Vente, ChineuseMeta } from '@/components/SalesList'

export default function DeposanteMesVentes() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [ventes, setVentes] = useState<Vente[]>([])
  const [chineuse, setChineuse] = useState<ChineuseMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/client/login'); return }
      setUser(u)

      let trigramme = ''
      try {
        const snap = await getDocs(
          query(collection(db, 'deposante'), where('email', '==', u.email))
        )
        if (snap.empty) { setLoading(false); return }

        const data = snap.docs[0].data()
        trigramme = data.trigramme || ''

        setChineuse({
          nom: data.nom,
          siret: data.siret,
          adresse1: data.adresse1,
          adresse2: data.adresse2,
          tva: data.tva,
          iban: data.iban,
          bic: data.bic,
          banqueAdresse: data.banqueAdresse,
          taux: data.taux,
          codeChineuse: trigramme,
        })
      } catch (err) {
        console.error('Erreur chargement deposante:', err)
      }

      await fetchVentes(trigramme, u.email!)
    })
    return () => unsub()
  }, [router])

  async function fetchVentes(trigramme: string, email: string) {
    setLoading(true)
    try {
      const param = trigramme
        ? `trigramme=${encodeURIComponent(trigramme)}`
        : `chineurEmail=${encodeURIComponent(email)}`
      const res = await fetch(`/api/ventes?${param}`)
      const data = await res.json()
      if (data.success) setVentes(data.ventes || [])
    } catch (err) {
      console.error('Erreur chargement ventes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (user?.email) await fetchVentes(chineuse?.codeChineuse || '', user.email)
  }

  return (
    <SalesList
      titre="MES VENTES CHEZ NOUVELLE RIVE"
      ventes={ventes}
      chineuse={chineuse}
      userEmail={user?.email || undefined}
      isAdmin={false}
      isDeposante={true}
      loading={loading}
      onRefresh={handleRefresh}
    />
  )
}