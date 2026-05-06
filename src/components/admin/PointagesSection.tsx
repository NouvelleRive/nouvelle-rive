// Section pointages dans la page admin/vendeuses
'use client'

import { useEffect, useState } from 'react'
import { Pencil, X, Save } from 'lucide-react'

type Vendeuse = { id: string; prenom?: string; nom?: string; couleur?: string; actif?: boolean }
type Pointage = { id: string; vendeuseId: string; date: string; arrivee: string | null; depart: string | null }

const fmtTime = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
}: {
  vendeuses: Vendeuse[]
  monthKey: string
  monthLabel: string
}) {
  const [pointages, setPointages] = useState<Pointage[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editArrivee, setEditArrivee] = useState('')
  const [editDepart, setEditDepart] = useState('')

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

  const saveEdit = async (id: string) => {
    const res = await fetch('/api/pointage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#22209C]">Pointages — {monthLabel}</h2>
        <button onClick={fetchPointages} className="text-xs text-gray-500 underline">Rafraîchir</button>
      </div>

      {/* Totaux par vendeuse */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Total heures travaillées (pour la paie)</h3>
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
                <th className="text-left px-3 py-2">Arrivée</th>
                <th className="text-left px-3 py-2">Départ</th>
                <th className="text-left px-3 py-2">Durée</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedPointages.map(p => {
                const isEdit = editingId === p.id
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.date}</td>
                    <td className="px-3 py-2 font-medium">{getVendeuseNom(p.vendeuseId)}</td>
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <input
                          type="datetime-local"
                          value={editArrivee}
                          onChange={e => setEditArrivee(e.target.value)}
                          className="border rounded px-1 py-0.5 text-xs"
                        />
                      ) : fmtTime(p.arrivee)}
                    </td>
                    <td className="px-3 py-2">
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
