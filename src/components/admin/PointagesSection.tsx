// Section pointages dans la page admin/vendeuses
'use client'

import { useEffect, useState } from 'react'
import { Pencil, X, Save, Plus } from 'lucide-react'
import { auth } from '@/lib/firebaseConfig'
import { pointageDocId } from '@/lib/pointage'

type Vendeuse = { id: string; prenom?: string; nom?: string; couleur?: string; actif?: boolean }
type Pointage = { id: string; vendeuseId: string; date: string; arrivee: string | null; depart: string | null }
type PlanningSlots = Record<string, string>

const fmtTime = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Renvoie le créneau prévu pour une vendeuse à une date (ou null)
const getSlot = (planningSlots: PlanningSlots, date: string, vendeuseId: string): '12-20' | '11-17' | null => {
  if (planningSlots[`${date}_12-20`] === vendeuseId) return '12-20'
  if (planningSlots[`${date}_11-17`] === vendeuseId) return '11-17'
  return null
}

// Décalage en minutes entre l'heure réelle et l'heure prévue du slot
const decalageMin = (iso: string | null, dateStr: string, slot: '12-20' | '11-17' | null, type: 'arr' | 'dep'): number | null => {
  if (!iso || !slot) return null
  const d = new Date(iso)
  const target = new Date(d)
  if (type === 'arr') target.setHours(slot === '12-20' ? 12 : 11, 0, 0, 0)
  else target.setHours(slot === '12-20' ? 20 : 17, 0, 0, 0)
  return Math.round((d.getTime() - target.getTime()) / 60000)
}

const SEUIL_DECALAGE_MIN = 10

// Style bleu si décalage > seuil (en + ou en -)
const timeClassName = (decalage: number | null): string => {
  if (decalage === null) return ''
  return Math.abs(decalage) > SEUIL_DECALAGE_MIN ? 'text-blue-600 font-semibold' : ''
}

const durationHours = (a: string | null, d: string | null): number => {
  if (!a || !d) return 0
  return (new Date(d).getTime() - new Date(a).getTime()) / 3600000
}

const fmtDuration = (h: number): string => {
  if (h <= 0) return '—'
  const heures = Math.floor(h)
  const minutes = Math.round((h - heures) * 60)
  return `${heures}h${String(minutes).padStart(2, '0')}`
}

export default function PointagesSection({
  vendeuses,
  monthKey,
  monthLabel,
  planningSlots = {},
  readOnly = false,
}: {
  vendeuses: Vendeuse[]
  monthKey: string
  monthLabel: string
  planningSlots?: PlanningSlots
  readOnly?: boolean
}) {
  const [pointages, setPointages] = useState<Pointage[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editArrivee, setEditArrivee] = useState('')
  const [editDepart, setEditDepart] = useState('')
  const [creating, setCreating] = useState(false)
  const [newVendeuseId, setNewVendeuseId] = useState('')
  const [newArrivee, setNewArrivee] = useState('')
  const [newDepart, setNewDepart] = useState('')

  const fetchPointages = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pointage?mois=${monthKey}`)
      const data = await res.json()
      if (data.success) setPointages(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPointages() }, [monthKey])

  const startEdit = (p: Pointage) => {
    setEditingId(p.id)
    setEditArrivee(p.arrivee ? p.arrivee.slice(0, 16) : '')
    setEditDepart(p.depart ? p.depart.slice(0, 16) : '')
  }

  const createPointage = async () => {
    if (!newVendeuseId || !newArrivee) {
      alert('Vendeuse et arrivée requises')
      return
    }
    const arriveeDate = new Date(newArrivee)
    const dateStr = `${arriveeDate.getFullYear()}-${String(arriveeDate.getMonth() + 1).padStart(2, '0')}-${String(arriveeDate.getDate()).padStart(2, '0')}`
    const id = pointageDocId(arriveeDate, newVendeuseId)
    const token = await auth.currentUser?.getIdToken()
    const res = await fetch('/api/pointage', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        id,
        vendeuseId: newVendeuseId,
        date: dateStr,
        arrivee: arriveeDate.toISOString(),
        depart: newDepart ? new Date(newDepart).toISOString() : null,
      }),
    })
    const data = await res.json()
    if (data.success) {
      setCreating(false)
      setNewVendeuseId('')
      setNewArrivee('')
      setNewDepart('')
      await fetchPointages()
    } else alert(data.error || 'Erreur')
  }

  const saveEdit = async (id: string) => {
    const token = await auth.currentUser?.getIdToken()
    const res = await fetch('/api/pointage', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        id,
        arrivee: editArrivee ? new Date(editArrivee).toISOString() : null,
        depart: editDepart ? new Date(editDepart).toISOString() : null,
      }),
    })
    const data = await res.json()
    if (data.success) {
      setEditingId(null)
      await fetchPointages()
    } else alert(data.error || 'Erreur')
  }

  // Total heures par vendeuse pour le mois
  const totalParVendeuse = new Map<string, number>()
  for (const p of pointages) {
    const h = durationHours(p.arrivee, p.depart)
    totalParVendeuse.set(p.vendeuseId, (totalParVendeuse.get(p.vendeuseId) || 0) + h)
  }

  // Pointages triés par date desc
  const sortedPointages = [...pointages].sort((a, b) => b.date.localeCompare(a.date) || a.vendeuseId.localeCompare(b.vendeuseId))

  const getVendeuseNom = (id: string) => vendeuses.find(v => v.id === id)?.prenom || id

  const startCreate = () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    setNewArrivee(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`)
    setCreating(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#22209C]">Pointages — {monthLabel}</h2>
        <div className="flex items-center gap-3">
          {!readOnly && !creating && (
            <button
              onClick={startCreate}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#22209C] text-white text-xs rounded-lg font-medium"
            >
              <Plus size={14} /> Créer un pointage
            </button>
          )}
          <button onClick={fetchPointages} className="text-xs text-gray-500 underline">Rafraîchir</button>
        </div>
      </div>

      {!readOnly && creating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">Nouveau pointage</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Vendeuse</label>
              <select
                value={newVendeuseId}
                onChange={e => setNewVendeuseId(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm bg-white"
              >
                <option value="">— Choisir —</option>
                {vendeuses.filter(v => v.actif !== false).map(v => (
                  <option key={v.id} value={v.id}>{v.prenom || v.nom || v.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Arrivée</label>
              <input
                type="datetime-local"
                value={newArrivee}
                onChange={e => setNewArrivee(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Départ (optionnel)</label>
              <input
                type="datetime-local"
                value={newDepart}
                onChange={e => setNewDepart(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createPointage}
                className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded font-medium"
              >
                Créer
              </button>
              <button
                onClick={() => { setCreating(false); setNewVendeuseId(''); setNewArrivee(''); setNewDepart('') }}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Totaux par vendeuse */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Total heures travaillées</h3>
        {totalParVendeuse.size === 0 ? (
          <p className="text-gray-400 text-sm">Aucun pointage ce mois-ci.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...totalParVendeuse.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([vid, h]) => (
                <div key={vid} className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500">{getVendeuseNom(vid)}</div>
                  <div className="font-bold text-lg">{fmtDuration(h)}</div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Liste détaillée */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm text-center py-8">Chargement…</p>
        ) : sortedPointages.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Aucun pointage</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Vendeuse</th>
                <th className="text-left px-3 py-2">Prévu</th>
                <th className="text-left px-3 py-2">Arrivée</th>
                <th className="text-left px-3 py-2">Départ</th>
                <th className="text-left px-3 py-2">Durée</th>
                {!readOnly && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {sortedPointages.map(p => {
                const isEdit = editingId === p.id
                const slot = getSlot(planningSlots, p.date, p.vendeuseId)
                const decArr = decalageMin(p.arrivee, p.date, slot, 'arr')
                const decDep = decalageMin(p.depart, p.date, slot, 'dep')
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.date}</td>
                    <td className="px-3 py-2 font-medium">{getVendeuseNom(p.vendeuseId)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{slot ? `${slot}h` : '—'}</td>
                    <td className={`px-3 py-2 ${timeClassName(decArr)}`} title={decArr !== null ? `${decArr > 0 ? '+' : ''}${decArr} min vs prévu` : ''}>
                      {isEdit ? (
                        <input
                          type="datetime-local"
                          value={editArrivee}
                          onChange={e => setEditArrivee(e.target.value)}
                          className="border rounded px-1 py-0.5 text-xs"
                        />
                      ) : fmtTime(p.arrivee)}
                    </td>
                    <td className={`px-3 py-2 ${timeClassName(decDep)}`} title={decDep !== null ? `${decDep > 0 ? '+' : ''}${decDep} min vs prévu` : ''}>
                      {isEdit ? (
                        <input
                          type="datetime-local"
                          value={editDepart}
                          onChange={e => setEditDepart(e.target.value)}
                          className="border rounded px-1 py-0.5 text-xs"
                        />
                      ) : fmtTime(p.depart)}
                    </td>
                    <td className="px-3 py-2">{fmtDuration(durationHours(p.arrivee, p.depart))}</td>
                    {!readOnly && (
                      <td className="px-3 py-2 text-right">
                        {isEdit ? (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => saveEdit(p.id)} className="text-green-600 hover:bg-green-50 p-1 rounded"><Save size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><X size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(p)} className="text-gray-500 hover:text-[#22209C]"><Pencil size={14} /></button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
