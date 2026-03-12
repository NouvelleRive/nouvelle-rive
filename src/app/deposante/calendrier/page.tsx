'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getPlacesDisponibles } from '@/lib/capaciteDepot'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/lib/firebaseConfig'
import PlanningCalendar from '@/components/PlanningCalendar'
import { useEtapes } from '../layout'

export default function DeposanteCalendrierPage() {
  const [userNom, setUserNom] = useState<string>('')
  const [placesDisponibles, setPlacesDisponibles] = useState<{ pap: number, maro: number, total: number } | null>(null)
  const [loadingPlaces, setLoadingPlaces] = useState(true)
  const [userTrigramme, setUserTrigramme] = useState<string>('')
  const etapes = useEtapes()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoadingPlaces(false); return }
      const snap = await getDocs(query(collection(db, 'chineuse'), where('email', '==', user.email)))
      if (!snap.empty) {
        const data = snap.docs[0].data()
        setUserNom((data.nom || data.trigramme || '').toUpperCase())
        setUserTrigramme((data.trigramme || '').toUpperCase())
      }

      // Fetch capacité + produits déposantes
      const now = new Date()
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const [configSnap, produitsSnap, restockSnap] = await Promise.all([
        getDoc(doc(db, 'config', 'capacite')),
        getDocs(collection(db, 'produits')),
        getDoc(doc(db, 'restocks', monthKey))
      ])
      const config = configSnap.exists()
        ? { maxPap: configSnap.data().maxPap || 0, maxMaro: configSnap.data().maxMaro || 0 }
        : { maxPap: 0, maxMaro: 0 }
      const produits = produitsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const restockSlots = restockSnap.exists() ? restockSnap.data().slots || {} : {}
      const today = now.toISOString().split('T')[0]
      try {
        setPlacesDisponibles(getPlacesDisponibles(produits, config, restockSlots, today))
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingPlaces(false)
      }
    })
    return () => unsub()
  }, [])

  if (!etapes.profil) return <div className="p-12 text-center text-gray-500">Complète ton profil pour continuer →</div>
  if (!etapes.contrat) return <div className="p-12 text-center text-gray-500">Signe ton contrat pour continuer →</div>
  if (!etapes.pieces) return <div className="p-12 text-center text-gray-500">Ajoute tes pièces pour continuer →</div>

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      {/* Status bar places */}
      {!loadingPlaces && placesDisponibles && (
        <div className="mb-4 text-sm font-medium">
          <span className={placesDisponibles.pap === 0 ? 'text-orange-500' : 'text-gray-600'}>
            PAP : {placesDisponibles.pap} place{placesDisponibles.pap !== 1 ? 's' : ''}
          </span>
          <span className="mx-2 text-gray-400">·</span>
          <span className={placesDisponibles.maro === 0 ? 'text-orange-500' : 'text-gray-600'}>
            MARO : {placesDisponibles.maro} place{placesDisponibles.maro !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {loadingPlaces ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
        </div>
      ) : placesDisponibles && placesDisponibles.total === 0 ? (
        <div className="text-center py-12">
          <p className="text-orange-500 font-medium">
            Le rack est complet pour le moment. Vous serez notifiée dès qu'une place se libère.
          </p>
        </div>
      ) : (
        <PlanningCalendar
          mode="restock"
          participants={userNom ? [{ nom: userNom, type: 'deposante', trigramme: userTrigramme }] : []}
          userType="deposante"
          userNom={userNom}
        />
      )}
    </div>
  )
}