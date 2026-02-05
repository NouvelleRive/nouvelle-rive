// app/vendeuse/inventaire/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebaseConfig'
import {
  collection,
  query,
  onSnapshot,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { getDocs } from 'firebase/firestore'
import InventaireList, { Produit, Deposant } from '@/components/InventaireList'

type Inventaire = {
  id: string
  nom: string
  dateDebut: Timestamp
  dateFin?: Timestamp | null
  creePar: string
  statut: 'en_cours' | 'termine'
}

export default function InventairePage() {
  const [vendeusePrenom, setVendeusePrenom] = useState<string>('')
  const [showVendeuseModal, setShowVendeuseModal] = useState(true)
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [inventaireActif, setInventaireActif] = useState<Inventaire | null>(null)
  const [loading, setLoading] = useState(true)

  const [vendeusesListe, setVendeusesListe] = useState<string[]>([])

  useEffect(() => {
    const fetchVendeuses = async () => {
      const snap = await getDocs(collection(db, 'vendeuses'))
      const noms = snap.docs
        .filter(d => d.data().actif)
        .map(d => d.data().prenom)
        .sort()
      setVendeusesListe(noms)
    }
    fetchVendeuses()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'produits'))
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Produit))
      setProduits(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'chineuse'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deposant))
      setDeposants(data)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(
      collection(db, 'inventaires'),
      orderBy('dateDebut', 'desc'),
      limit(10)
    )
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Inventaire))
      const enCours = data.find((i) => i.statut === 'en_cours')
      if (enCours && !inventaireActif) {
        setInventaireActif(enCours)
      }
    })
    return () => unsub()
  }, [])

  if (showVendeuseModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-sm w-full p-6">
          <h2 className="text-lg font-semibold mb-4 text-center text-gray-900">
            Qui êtes-vous ?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {vendeusesListe.map((prenom) => (
              <button
                key={prenom}
                onClick={() => {
                  setVendeusePrenom(prenom)
                  setShowVendeuseModal(false)
                }}
                className="p-4 border border-gray-200 rounded-xl text-center hover:border-[#22209C] hover:bg-[#22209C]/5 transition-all font-medium"
              >
                {prenom}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {inventaireActif ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 animate-pulse" />
                  <span className="font-medium text-gray-900 truncate">
                    {inventaireActif.nom}
                  </span>
                  <span className="text-xs text-gray-400 hidden sm:inline">
                    (depuis le {format(inventaireActif.dateDebut.toDate(), 'dd/MM', { locale: fr })})
                  </span>
                </div>
              ) : (
                <span className="text-gray-500 text-sm">Aucun inventaire en cours</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {inventaireActif ? (
        <InventaireList
          mode="inventaire"
          produits={produits}
          deposants={deposants}
          inventaireId={inventaireActif.id}
          inventaireNom={inventaireActif.nom}
          vendeusePrenom={vendeusePrenom}
          loading={loading}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
          <Calendar size={48} className="text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-600 mb-2">
            Pas d'inventaire en cours
          </h2>
          <p className="text-sm text-gray-400">
            En attente de l'ouverture par l'admin
          </p>
        </div>
      )}
    </div>
  )
}