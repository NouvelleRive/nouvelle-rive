'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/lib/firebaseConfig'
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CheckCircle, AlertTriangle, Filter } from 'lucide-react'

type Inventaire = {
  id: string
  nom: string
  dateDebut: Timestamp
  dateFin?: Timestamp | null
  statut: 'en_cours' | 'termine'
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
}

export default function AdminInventairesPage() {
  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [manquantsParMois, setManquantsParMois] = useState<Record<string, Manquant[]>>({})
  const [produits, setProduits] = useState<Produit[]>([])
  const [filtreChineuse, setFiltreChineuse] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Charger les inventaires terminés
  useEffect(() => {
    const q = query(
      collection(db, 'inventaires'),
      orderBy('dateDebut', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Inventaire))
        .filter((i) => i.statut === 'termine')
      setInventaires(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Charger les manquants pour chaque inventaire
  useEffect(() => {
    if (inventaires.length === 0) return

    const unsubscribes: (() => void)[] = []

    for (const inv of inventaires) {
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

  // Charger les produits pour avoir les infos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'produits'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Produit))
      setProduits(data)
    })
    return () => unsub()
  }, [])

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
        // Trier par trigramme puis par numéro SKU
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

  // Vérifier si une pièce est traitée (dans n'importe quel mois)
  const estTraite = (sku: string): boolean => {
    return Object.values(manquantsParMois)
      .flat()
      .some((m) => m.sku === sku && m.traite)
  }

  // Marquer comme traité
  const handleTraiter = async (sku: string) => {
    // Trouver tous les docs manquants avec ce SKU et les marquer traités
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

  if (inventaires.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-600">Aucun inventaire clôturé</h2>
        <p className="text-sm text-gray-400">Les inventaires terminés apparaîtront ici</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Historique des inventaires</h1>
        
        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-red-600 font-semibold">{stats.totalManquants}</span>
              <span className="text-red-500 ml-1">manquants</span>
            </div>
            <div className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
              <span className="text-orange-600 font-semibold">{stats.valeurTotale.toFixed(0)}€</span>
              <span className="text-orange-500 ml-1">valeur</span>
            </div>
          </div>

          {/* Filtre chineuse */}
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
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Chineuse</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Prix</th>
                {inventaires.map((inv) => (
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
                  {inventaires.map((inv) => {
                    const manquant = estManquant(piece.sku, inv.id)
                    return (
                      <td key={inv.id} className="px-4 py-3 text-center">
                        {manquant ? (
                          <span className="inline-block w-3 h-3 bg-red-500 rounded-full" title="Manquant" />
                        ) : (
                          <span className="inline-block w-3 h-3 bg-gray-200 rounded-full" title="OK ou pas encore inventorié" />
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
                  <td colSpan={5 + inventaires.length} className="px-4 py-2 bg-gray-100 text-xs text-gray-500 font-medium">
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
                  {inventaires.map((inv) => {
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
                  <td colSpan={5 + inventaires.length} className="px-4 py-8 text-center text-gray-400">
                    Aucune pièce manquante
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}