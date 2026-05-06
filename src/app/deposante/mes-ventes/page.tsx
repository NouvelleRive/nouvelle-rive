'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, onSnapshot, query, where, orderBy, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import SalesList, { Vente, ChineuseMeta } from '@/components/SalesList'
import { useEtapes } from '../layout'

export default function DeposanteMesVentes() {
  const router = useRouter()
  const etapes = useEtapes()
  const [user, setUser] = useState<User | null>(null)
  const [ventes, setVentes] = useState<Vente[]>([])
  const [chineuse, setChineuse] = useState<ChineuseMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubVentes: (() => void) | undefined
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/client/login'); return }
      setUser(u)

      let trigramme = ''
      try {
        const snap = await getDoc(doc(db, 'deposante', u.uid))
        if (!snap.exists()) {
          // Fallback ancien doc avec authUid en field
          const fb = await getDocs(query(collection(db, 'deposante'), where('authUid', '==', u.uid)))
          if (fb.empty) { setLoading(false); return }
          const data = fb.docs[0].data()
          trigramme = data.trigramme || ''
          setChineuse({
            nom: data.nom, siret: data.siret, adresse1: data.adresse1, adresse2: data.adresse2,
            tva: data.tva, iban: data.iban, bic: data.bic, banqueAdresse: data.banqueAdresse,
            taux: data.taux, codeChineuse: trigramme,
          })
        } else {
          const data = snap.data() as any
          trigramme = data.trigramme || ''
          setChineuse({
            nom: data.nom, siret: data.siret, adresse1: data.adresse1, adresse2: data.adresse2,
            tva: data.tva, iban: data.iban, bic: data.bic, banqueAdresse: data.banqueAdresse,
            taux: data.taux, codeChineuse: trigramme,
          })
        }
      } catch (err) {
        console.error('Erreur chargement deposante:', err)
      }

      if (!trigramme) { setLoading(false); return }

      // Listener temps réel : ventes auto-refreshées dès qu'il y a une nouvelle vente
      const q = query(
        collection(db, 'ventes'),
        where('trigramme', '==', trigramme),
        orderBy('date', 'desc')
      )
      unsubVentes = onSnapshot(q, (snap) => {
        const data: Vente[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
        setVentes(data)
        setLoading(false)
      }, (err) => {
        console.error('Erreur listener ventes:', err)
        setLoading(false)
      })
    })
    return () => { unsub(); unsubVentes?.() }
  }, [router])

  if (!etapes.profil) return <div className="p-12 text-center text-gray-500">Complète ton profil pour continuer →</div>
  if (!etapes.contrat) return <div className="p-12 text-center text-gray-500">Signe ton contrat pour continuer →</div>
  if (!etapes.pieces) return <div className="p-12 text-center text-gray-500">Ajoute tes pièces pour continuer →</div>

  return (
    <SalesList
      titre="MES VENTES CHEZ NOUVELLE RIVE"
      ventes={ventes}
      chineuse={chineuse}
      userEmail={user?.email || undefined}
      isAdmin={false}
      isDeposante={true}
      loading={loading}
    />
  )
}