// app/vendeuse/inventaire/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { db, auth } from '@/lib/firebaseConfig'
import {
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  Timestamp,
  orderBy,
  limit,
  getDocs,
  where,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, Calendar, CheckCircle } from 'lucide-react'
import InventaireList, { Produit, Deposant } from '@/components/InventaireList'

type Inventaire = {
  id: string
  nom: string
  dateDebut: Timestamp
  dateFin?: Timestamp | null
  creePar: string
  statut: 'en_cours' | 'termine'
}

const VENDEUSES = ['Hina', 'Sofia', 'Loah', 'Teo', 'Salomé']
const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

export default function InventairePage() {
  const [vendeusePrenom, setVendeusePrenom] = useState<string>('')
  const [showVendeuseModal, setShowVendeuseModal] = useState(true)
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [inventaireActif, setInventaireActif] = useState<Inventaire | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewInventaireModal, setShowNewInventaireModal] = useState(false)
  const [newInventaireNom, setNewInventaireNom] = useState('')
  const [creatingInventaire, setCreatingInventaire] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user?.email === ADMIN_EMAIL)
    })
    return () => unsub()
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
      setInventaires(data)
      const enCours = data.find((i) => i.statut === 'en_cours')
      if (enCours && !inventaireActif) {
        setInventaireActif(enCours)
      }
    })
    return () => unsub()
  }, [])

  const handleCreateInventaire = async () => {
    if (!newInventaireNom.trim()) {
      alert('Veuillez donner un nom à l\'inventaire')
      return
    }
    if (!vendeusePrenom) {
      alert('Veuillez sélectionner votre prénom')
      return
    }

    setCreatingInventaire(true)
    try {
      for (const inv of inventaires.filter((i) => i.statut === 'en_cours')) {
        await updateDoc(doc(db, 'inventaires', inv.id), {
          statut: 'termine',
          dateFin: Timestamp.now(),
        })
      }

      const docRef = await addDoc(collection(db, 'inventaires'), {
        nom: newInventaireNom.trim(),
        dateDebut: Timestamp.now(),
        dateFin: null,
        creePar: vendeusePrenom,
        statut: 'en_cours',
      })

      setInventaireActif({
        id: docRef.id,
        nom: newInventaireNom.trim(),
        dateDebut: Timestamp.now(),
        dateFin: null,
        creePar: vendeusePrenom,
        statut: 'en_cours',
      })

      setShowNewInventaireModal(false)
      setNewInventaireNom('')
    } catch (err) {
      console.error('Erreur création inventaire:', err)
      alert('Erreur lors de la création')
    } finally {
      setCreatingInventaire(false)
    }
  }

  const handleTerminerInventaire = async () => {
    if (!inventaireActif) return
    if (!confirm('Terminer cet inventaire ? Les pièces non trouvées seront enregistrées comme manquantes.')) return

    try {
      // Trouver les produits manquants (non cochés pendant cet inventaire)
      const manquants = produits.filter((p) => {
        // Exclure les vendus, supprimés, retours, quantité 0
        if (p.vendu || p.statut === 'supprime' || p.statut === 'retour' || (p.quantite ?? 1) <= 0) return false
        // Manquant = pas inventorié pendant cet inventaire
        return p.inventaireId !== inventaireActif.id
      })

      // Sauvegarder chaque manquant dans la sous-collection
      for (const p of manquants) {
        const trigramme = deposants.find(d => d.email === p.chineur)?.trigramme || p.chineur?.split('@')[0] || 'N/A'
        await setDoc(doc(db, 'inventaires', inventaireActif.id, 'manquants', p.sku || p.id), {
          sku: p.sku || '',
          produitId: p.id,
          nom: p.nom,
          prix: p.prix || 0,
          trigramme: trigramme,
          signalePar: vendeusePrenom,
          dateSignalement: Timestamp.now(),
          traite: false,
        })
      }

      // Mettre à jour le statut de l'inventaire
      await updateDoc(doc(db, 'inventaires', inventaireActif.id), {
        statut: 'termine',
        dateFin: Timestamp.now(),
        nbManquants: manquants.length,
        valeurManquants: manquants.reduce((sum, p) => sum + (p.prix || 0), 0),
      })

      setInventaireActif(null)
      alert(`Inventaire clôturé. ${manquants.length} pièce(s) manquante(s) enregistrée(s).`)
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la clôture')
    }
  }

  if (showVendeuseModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-sm w-full p-6">
          <h2 className="text-lg font-semibold mb-4 text-center text-gray-900">
            Qui êtes-vous ?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {VENDEUSES.map((prenom) => (
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

            {isAdmin && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {inventaireActif ? (
                  <button
                    onClick={handleTerminerInventaire}
                    className="px-3 py-1.5 text-xs border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
                  >
                    <CheckCircle size={14} />
                    <span className="hidden sm:inline">Clôturer {inventaireActif.nom.replace('Inventaire ', '')}</span>
                    <span className="sm:hidden">Clôturer</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setNewInventaireNom(`Inventaire ${format(new Date(), 'MMMM yyyy', { locale: fr })}`)
                      setShowNewInventaireModal(true)
                    }}
                    className="px-3 py-1.5 text-xs bg-[#22209C] text-white rounded-lg hover:bg-[#1a1878] transition-colors flex items-center gap-1"
                  >
                    <Plus size={14} />
                    <span className="hidden sm:inline">Ouvrir inventaire</span>
                    <span className="sm:hidden">Ouvrir</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {inventaires.length > 0 && !inventaireActif && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Inventaires précédents :</p>
              <div className="flex flex-wrap gap-2">
                {inventaires
                  .filter((i) => i.statut === 'termine')
                  .slice(0, 3)
                  .map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => setInventaireActif(inv)}
                      className="px-3 py-1 text-xs border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {inv.nom}
                    </button>
                  ))}
              </div>
            </div>
          )}
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
          <p className="text-sm text-gray-400 mb-4">
            {isAdmin ? 'Ouvrez un nouvel inventaire pour commencer' : 'En attente de l\'ouverture par l\'admin'}
          </p>
          {isAdmin && (
            <button
              onClick={() => {
                setNewInventaireNom(`Inventaire ${format(new Date(), 'MMMM yyyy', { locale: fr })}`)
                setShowNewInventaireModal(true)
              }}
              className="px-4 py-2 bg-[#22209C] text-white rounded-lg hover:bg-[#1a1878] transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Ouvrir inventaire
            </button>
          )}
        </div>
      )}

      {showNewInventaireModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Nouvel inventaire
            </h3>
            <input
              type="text"
              value={newInventaireNom}
              onChange={(e) => setNewInventaireNom(e.target.value)}
              placeholder="Ex: Inventaire Décembre 2025"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewInventaireModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateInventaire}
                disabled={creatingInventaire || !newInventaireNom.trim()}
                className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm hover:bg-[#1a1878] disabled:opacity-50 transition-colors"
              >
                {creatingInventaire ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}