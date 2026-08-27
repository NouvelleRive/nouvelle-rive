// app/acheteuse/mes-ventes/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { getDoc, doc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import SalesList, { Vente, ChineuseMeta } from '@/components/SalesList'
import EnableNotifsButton from '@/components/EnableNotifsButton'
import { ACHETEUSE_CHINEUSE_DOC, ACHETEUSE_TRIGRAMME } from '@/lib/roles'

export default function AcheteuseMesVentesPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [ventes, setVentes] = useState<Vente[]>([])
  const [chineuse, setChineuse] = useState<ChineuseMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/login'); return }
      setUser(u)
      try {
        const snap = await getDoc(doc(db, 'chineuse', ACHETEUSE_CHINEUSE_DOC))
        if (snap.exists()) {
          const d = snap.data() as any
          setChineuse({
            nom: d.nom,
            siret: d.siret,
            adresse1: d.adresse1,
            adresse2: d.adresse2,
            tva: d.tva,
            iban: d.iban,
            bic: d.bic,
            banqueAdresse: d.banqueAdresse,
            taux: d.taux,
            codeChineuse: d.trigramme || ACHETEUSE_TRIGRAMME,
          })
        }
      } catch (err) {
        console.error('Erreur chargement acheteuse:', err)
      }
      await fetchVentes()
    })
    return () => unsub()
  }, [router])

  async function fetchVentes() {
    setLoading(true)
    try {
      const res = await fetch(`/api/ventes?trigramme=${encodeURIComponent(ACHETEUSE_TRIGRAMME)}`)
      const data = await res.json()
      if (data.success) setVentes(data.ventes || [])
    } catch (err) {
      console.error('Erreur chargement ventes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.email) return
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      fetchVentes()
    }, 5 * 60 * 1000)
    const onFocus = () => fetchVentes()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [user?.email])

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 pt-4 flex justify-end">
        <EnableNotifsButton ownerId={ACHETEUSE_CHINEUSE_DOC} label="Recevoir une notif quand je vends" />
      </div>
      <SalesList
        titre="MES VENTES"
        ventes={ventes}
        chineuse={chineuse}
        userEmail={user?.email || undefined}
        isAdmin={false}
        loading={loading}
        onRefresh={fetchVentes}
      />
    </>
  )
}
