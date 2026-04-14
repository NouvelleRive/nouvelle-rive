'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import PlanningCalendar from '@/components/PlanningCalendar'

export default function ChineuseCalendrierPage() {
  const [userNom, setUserNom] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [chineuseId, setChineuseId] = useState<string>('')
  const [nbArticles, setNbArticles] = useState<number>(0)
  const [dernierRestock, setDernierRestock] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return
      setUserEmail(user.email || '')

      // Fetch profil chineuse — chercher dans le champ emails (array) pour les comptes multi-users (ex: PS)
      let snap = await getDocs(query(collection(db, 'chineuse'), where('emails', 'array-contains', user.email)))
      if (snap.empty) {
        // Fallback sur email principal
        snap = await getDocs(query(collection(db, 'chineuse'), where('email', '==', user.email)))
      }
      let trigramme = ''
      if (!snap.empty) {
        const data = snap.docs[0].data()
        const nom = (data.nom || data.trigramme || '').toUpperCase()
        trigramme = data.trigramme || ''
        setUserNom(nom)
        setChineuseId(snap.docs[0].id)
      }

      // Fetch produits par trigramme (pour voir tous les produits du compte partagé)
      const prodSnap = trigramme
        ? await getDocs(query(collection(db, 'produits'), where('trigramme', '==', trigramme)))
        : await getDocs(query(collection(db, 'produits'), where('chineur', '==', user.email)))
      const produits = prodSnap.docs.map(d => ({ ...d.data() }))
      setNbArticles(produits.filter((p: any) => !p.vendu).length)

      const sorted = produits
        .filter((p: any) => p.createdAt instanceof Timestamp)
        .sort((a: any, b: any) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
      if (sorted.length > 0) setDernierRestock((sorted[0] as any).createdAt.toDate())

      setLoading(false)
    })
    return () => unsub()
  }, [])

  const joursDepuis = dernierRestock
    ? Math.floor((Date.now() - dernierRestock.getTime()) / (1000 * 60 * 60 * 24))
    : null

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
    </div>
  )

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-6">
      <div className="lg:col-span-2">
        <PlanningCalendar
          mode="restock"
          participants={userNom ? [{ nom: userNom, type: 'chineuse' }] : []}
          userType="chineuse"
          userNom={userNom}
        />
      </div>

      <div>
        <div className="bg-white rounded-xl border p-4 mt-[140px]">
          <p className="text-sm font-bold text-[#22209C] mb-3">{userNom}</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Articles en vente</span>
              <span className="font-semibold">{nbArticles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Dernier restock</span>
              <span className={`font-semibold ${joursDepuis === null || joursDepuis > 30 ? 'text-red-500' : ''}`}>
                {dernierRestock
                  ? dernierRestock.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  : 'jamais'}
              </span>
            </div>
            {joursDepuis !== null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Depuis</span>
                <span className={`font-semibold ${joursDepuis > 30 ? 'text-red-500' : ''}`}>
                  J+{joursDepuis}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}