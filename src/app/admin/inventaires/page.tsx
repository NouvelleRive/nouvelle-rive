'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/lib/firebaseConfig'
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  setDoc,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CheckCircle, AlertTriangle, Filter, Plus, Lock, Unlock } from 'lucide-react'

type Inventaire = {
  id: string
  nom: string
  dateDebut: Timestamp
  dateFin?: Timestamp | null
  statut: 'en_cours' | 'termine'
  nbManquants?: number
  valeurManquants?: number
}

type Manquant = {
  id: string
  sku: string
  produitId: string
  nom: string
  prix: number
  trigramme: string
  signalePar: string
  dateSignalement: Timestamp
  traite?: boolean
  dateTraitement?: Timestamp
}

type Produit = {
  id: string
  sku?: string
  nom: string
  prix?: number
  trigramme?: string
  chineur?: string
  vendu?: boolean
  quantite?: number
  statut?: string
  inventaireId?: string
}

type Deposant = {
  id: string
  email: string
  trigramme?: string
}

export default function AdminInventairesPage() {
  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [manquantsParMois, setManquantsParMois] = useState<Record<string, Manquant[]>>({})
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [filtreChineuse, setFiltreChineuse] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newInventaireNom, setNewInventaireNom] = useState('')
  const [processing, setProcessing] = useState(false)

  // Charger les inventaires
  useEffect(() => {
    const q = query(
      collection(db, 'inventaires'),
      orderBy('dateDebut', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Inventaire))
      setInventaires(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Charger les manquants pour chaque inventaire terminé
  useEffect(() => {
    const termines = inventaires.filter((i) => i.statut === 'termine')
    if (termines.length === 0) return

    const unsubscribes: (() => void)[] = []

    for (const inv of termines) {
      const unsub = onSnapshot(
        collection(db, 'inventaires', inv.id, 'manquants'),
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Manquant))
          setManquantsParMois((prev) => ({ ...prev, [inv.id]: data }))
        }
      )
      unsubscribes.push(unsub)
    }

    return () => unsubscribes.forEach((u) => u())
  }, [inventaires])

  // Charger les produits
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'produits'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Produit))
      setProduits(data)
    })
    return () => unsub()
  }, [])

  // Charger les déposants
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'chineuse'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deposant))
      setDeposants(data)
    })
    return () => unsub()
  }, [])

  // Inventaire en cours
  const inventaireEnCours = useMemo(() => {
    return inventaires.find((i) => i.statut === 'en_cours') || null
  }, [inventaires])

  // Inventaires terminés
  const inventairesTermines = useMemo(() => {
    return inventaires.filter((i) => i.statut === 'termine')
  }, [inventaires])

  // Liste des chineuses uniques
  const chineuses = useMemo(() => {
    const set = new Set<string>()
    Object.values(manquantsParMois).flat().forEach((m) => {
      if (m.trigramme) set.add(m.trigramme)
    })
    return Array.from(set).sort()
  }, [manquantsParMois])

  // Construire le tableau : toutes les pièces manquantes uniques
  const piecesUniques = useMemo(() => {
    const map = new Map<string, { sku: string; nom: string; prix: number; trigramme: string; produitId: string }>()
    
    Object.values(manquantsParMois).flat().forEach((m) => {
      if (!map.has(m.sku)) {
        map.set(m.sku, {
          sku: m.sku,
          nom: m.nom,
          prix: m.prix,
          trigramme: m.trigramme,
          produitId: m.produitId,
        })
      }
    })

    return Array.from(map.values())
      .filter((p) => !filtreChineuse || p.trigramme === filtreChineuse)
      .sort((a, b) => {
        if (a.trigramme !== b.trigramme) return a.trigramme.localeCompare(b.trigramme)
        const numA = parseInt(a.sku.replace(/\D/g, '')) || 0
        const numB = parseInt(b.sku.replace(/\D/g, '')) || 0
        return numA - numB
      })
  }, [manquantsParMois, filtreChineuse])

  // Vérifier si une pièce est manquante pour un mois donné
  const estManquant = (sku: string, invId: string): Manquant | undefined => {
    return manquantsParMois[invId]?.find((m) => m.sku === sku)
  }

  // Vérifier si une pièce est traitée
  const estTraite = (sku: string): boolean => {
    return Object.values(manquantsParMois)
      .flat()
      .some((m) => m.sku === sku && m.traite)
  }

  // Marquer comme traité
  const handleTraiter = async (sku: string) => {
    for (const [invId, manquants] of Object.entries(manquantsParMois)) {
      const m = manquants.find((x) => x.sku === sku)
      if (m) {
        await updateDoc(doc(db, 'inventaires', invId, 'manquants', m.id), {
          traite: true,
          dateTraitement: Timestamp.now(),
        })
      }
    }
  }

  // Ouvrir un nouvel inventaire
  const handleOuvrirInventaire = async () => {
    if (!newInventaireNom.trim()) {
      alert('Veuillez donner un nom à l\'inventaire')
      return
    }

    setProcessing(true)
    try {
      // D'abord clôturer l'inventaire en cours s'il existe
      if (inventaireEnCours) {
        await handleCloturerInventaire(inventaireEnCours)
      }

      // Créer le nouvel inventaire
      await addDoc(collection(db, 'inventaires'), {
        nom: newInventaireNom.trim(),
        dateDebut: Timestamp.now(),
        dateFin: null,
        creePar: 'Admin',
        statut: 'en_cours',
      })

      setShowNewModal(false)
      setNewInventaireNom('')
    } catch (err) {
      console.error('Erreur création inventaire:', err)
      alert('Erreur lors de la création')
    } finally {
      setProcessing(false)
    }
  }

  // Clôturer un inventaire
  const handleCloturerInventaire = async (inv: Inventaire) => {
    try {
      // Trouver les produits manquants
      const manquants = produits.filter((p) => {
        if (p.vendu || p.statut === 'supprime' || p.statut === 'retour' || (p.quantite ?? 1) <= 0) return false
        return p.inventaireId !== inv.id
      })

      // Sauvegarder chaque manquant
      for (const p of manquants) {
        const trigramme = deposants.find(d => d.email === p.chineur)?.trigramme || p.chineur?.split('@')[0] || 'N/A'
        await setDoc(doc(db, 'inventaires', inv.id, 'manquants', p.sku || p.id), {
          sku: p.sku || '',
          produitId: p.id,
          nom: p.nom,
          prix: p.prix || 0,
          trigramme: trigramme,
          signalePar: 'Admin',
          dateSignalement: Timestamp.now(),
          traite: false,
        })
      }

      // Mettre à jour le statut
      await updateDoc(doc(db, 'inventaires', inv.id), {
        statut: 'termine',
        dateFin: Timestamp.now(),
        nbManquants: manquants.length,
        valeurManquants: manquants.reduce((sum, p) => sum + (p.prix || 0), 0),
      })

      return manquants.length
    } catch (err) {
      console.error('Erreur clôture:', err)
      throw err
    }
  }

  // Clôturer avec confirmation
  const handleCloturerAvecConfirm = async () => {
    if (!inventaireEnCours) return
    if (!confirm(`Clôturer "${inventaireEnCours.nom}" ? Les pièces non trouvées seront enregistrées comme manquantes.`)) return

    setProcessing(true)
    try {
      const nbManquants = await handleCloturerInventaire(inventaireEnCours)
      alert(`Inventaire clôturé. ${nbManquants} pièce(s) manquante(s) enregistrée(s).`)
    } catch (err) {
      alert('Erreur lors de la clôture')
    } finally {
      setProcessing(false)
    }
  }

  // Stats
  const stats = useMemo(() => {
    const nonTraites = piecesUniques.filter((p) => !estTraite(p.sku))
    return {
      totalManquants: nonTraites.length,
      valeurTotale: nonTraites.reduce((sum, p) => sum + (p.prix || 0), 0),
    }
  }, [piecesUniques, manquantsParMois])

  // Séparer traités et non traités
  const { piecesNonTraitees, piecesTraitees } = useMemo(() => {
    const nonTraitees = piecesUniques.filter((p) => !estTraite(p.sku))
    const traitees = piecesUniques.filter((p) => estTraite(p.sku))
    return { piecesNonTraitees: nonTraitees, piecesTraitees: traitees }
  }, [piecesUniques, manquantsParMois])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header avec boutons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Inventaires</h1>
        
        <div className="flex items-center gap-3">
          {inventaireEnCours ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-700 font-medium">{inventaireEnCours.nom}</span>
              </div>
              <button
                onClick={handleCloturerAvecConfirm}
                disabled={processing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Lock size={16} />
                Clôturer
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setNewInventaireNom(`Inventaire ${format(new Date(), 'MMMM yyyy', { locale: fr })}`)
                setShowNewModal(true)
              }}
              disabled={processing}
              className="px-4 py-2 bg-[#22209C] text-white rounded-lg hover:bg-[#1a1878] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Unlock size={16} />
              Ouvrir un inventaire
            </button>
          )}
        </div>
      </div>

      {/* Stats et filtres */}
      {inventairesTermines.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-red-600 font-semibold">{stats.totalManquants}</span>
              <span className="text-red-500 ml-1 text-sm">manquants</span>
            </div>
            <div className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
              <span className="text-orange-600 font-semibold">{stats.valeurTotale.toFixed(0)}€</span>
              <span className="text-orange-500 ml-1 text-sm">valeur</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={filtreChineuse}
              onChange={(e) => setFiltreChineuse(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Toutes les chineuses</option>
              {chineuses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Message si aucun inventaire terminé */}
      {inventairesTermines.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-600">Aucun inventaire clôturé</h2>
          <p className="text-sm text-gray-400 mt-1">Les inventaires terminés apparaîtront ici</p>
        </div>
      ) : (
        /* Tableau */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Chineuse</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Prix</th>
                  {inventairesTermines.map((inv) => (
                    <th key={inv.id} className="text-center px-4 py-3 font-medium text-gray-600">
                      {format(inv.dateDebut.toDate(), 'MMM yy', { locale: fr })}
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {/* Pièces non traitées */}
                {piecesNonTraitees.map((piece) => (
                  <tr key={piece.sku} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium">{piece.sku}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{piece.nom}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                        {piece.trigramme}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{piece.prix}€</td>
                    {inventairesTermines.map((inv) => {
                      const manquant = estManquant(piece.sku, inv.id)
                      return (
                        <td key={inv.id} className="px-4 py-3 text-center">
                          {manquant ? (
                            <span className="inline-block w-3 h-3 bg-red-500 rounded-full" title="Manquant" />
                          ) : (
                            <span className="inline-block w-3 h-3 bg-gray-200 rounded-full" title="OK" />
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleTraiter(piece.sku)}
                        className="px-3 py-1 text-xs bg-[#22209C] text-white rounded-lg hover:bg-[#1a1878] transition-colors"
                      >
                        Traiter
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Séparateur si pièces traitées */}
                {piecesTraitees.length > 0 && piecesNonTraitees.length > 0 && (
                  <tr>
                    <td colSpan={5 + inventairesTermines.length} className="px-4 py-2 bg-gray-100 text-xs text-gray-500 font-medium">
                      Pièces traitées ({piecesTraitees.length})
                    </td>
                  </tr>
                )}

                {/* Pièces traitées */}
                {piecesTraitees.map((piece) => (
                  <tr key={piece.sku} className="border-b border-gray-100 bg-gray-50 text-gray-400">
                    <td className="px-4 py-3 font-mono">{piece.sku}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{piece.nom}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">
                        {piece.trigramme}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{piece.prix}€</td>
                    {inventairesTermines.map((inv) => {
                      const manquant = estManquant(piece.sku, inv.id)
                      return (
                        <td key={inv.id} className="px-4 py-3 text-center">
                          {manquant ? (
                            <span className="inline-block w-3 h-3 bg-gray-400 rounded-full" />
                          ) : (
                            <span className="inline-block w-3 h-3 bg-gray-200 rounded-full" />
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center">
                      <CheckCircle size={16} className="inline text-green-500" />
                    </td>
                  </tr>
                ))}

                {piecesUniques.length === 0 && (
                  <tr>
                    <td colSpan={5 + inventairesTermines.length} className="px-4 py-8 text-center text-gray-400">
                      Aucune pièce manquante 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nouvel inventaire */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Ouvrir un inventaire
            </h3>
            <input
              type="text"
              value={newInventaireNom}
              onChange={(e) => setNewInventaireNom(e.target.value)}
              placeholder="Ex: Inventaire Janvier 2026"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleOuvrirInventaire}
                disabled={processing || !newInventaireNom.trim()}
                className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm hover:bg-[#1a1878] disabled:opacity-50 transition-colors"
              >
                {processing ? 'Création...' : 'Ouvrir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}