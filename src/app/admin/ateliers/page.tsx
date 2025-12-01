// app/admin/ateliers/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, Trash2, Users, Calendar, MapPin, ChevronLeft, ChevronRight } from 'lucide-react'
import { auth } from '@/lib/firebaseConfig'

type Creneau = {
  id: string
  date: string
  heure: string
  lieu: 'ecouffes' | 'printemps'
  placesMax: number
  placesReservees: number
}

type Reservation = {
  id: string
  creneauId: string
  nom: string
  email: string
  telephone: string
  participants: number
  paye: boolean
  createdAt: string
}

const LIEUX = {
  ecouffes: { nom: 'Boutique Nouvelle Rive', adresse: '8 rue des Écouffes' },
  printemps: { nom: 'Printemps Haussmann', adresse: '64 Boulevard Haussmann' },
}

export default function AdminAteliersPage() {
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  
  // Modal création
  const [showModal, setShowModal] = useState(false)
  const [newCreneau, setNewCreneau] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    heure: '14:00',
    lieu: 'ecouffes' as 'ecouffes' | 'printemps',
    placesMax: 4,
  })
  const [saving, setSaving] = useState(false)

  // Vue détail réservations
  const [selectedCreneau, setSelectedCreneau] = useState<Creneau | null>(null)

  useEffect(() => {
    loadData()
  }, [weekOffset])

  const getAuthToken = async () => {
    const user = auth.currentUser
    if (!user) return null
    return user.getIdToken()
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) return

      const startDate = addDays(new Date(), weekOffset * 7)
      const endDate = addDays(startDate, 7)
      
      const res = await fetch(`/api/ateliers/admin/creneaux?start=${startDate.toISOString()}&end=${endDate.toISOString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (res.ok) {
        const data = await res.json()
        setCreneaux(data.creneaux || [])
        setReservations(data.reservations || [])
      }
    } catch (err) {
      console.error('Erreur chargement', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCreneau = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const token = await getAuthToken()
      if (!token) return

      const res = await fetch('/api/ateliers/admin/creneaux', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newCreneau),
      })

      if (res.ok) {
        setShowModal(false)
        setNewCreneau({
          date: format(new Date(), 'yyyy-MM-dd'),
          heure: '14:00',
          lieu: 'ecouffes',
          placesMax: 4,
        })
        loadData()
      } else {
        const error = await res.json()
        alert(error.error || 'Erreur création')
      }
    } catch (err) {
      alert('Erreur création')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCreneau = async (creneauId: string) => {
    if (!confirm('Supprimer ce créneau ?')) return
    
    try {
      const token = await getAuthToken()
      if (!token) return

      const res = await fetch(`/api/ateliers/admin/creneaux?id=${creneauId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        loadData()
      } else {
        alert('Erreur suppression')
      }
    } catch (err) {
      alert('Erreur suppression')
    }
  }

  const startOfWeek = addDays(new Date(), weekOffset * 7)

  // Grouper créneaux par jour
  const creneauxParJour = creneaux.reduce((acc, c) => {
    const jour = c.date.split('T')[0]
    if (!acc[jour]) acc[jour] = []
    acc[jour].push(c)
    return acc
  }, {} as Record<string, Creneau[]>)

  // Réservations pour un créneau
  const getReservationsCreneau = (creneauId: string) => {
    return reservations.filter(r => r.creneauId === creneauId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#22209C]">Ateliers Upcycling</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#22209C] text-white rounded-lg hover:bg-[#1a1878]"
        >
          <Plus size={20} />
          Nouveau créneau
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-sm text-gray-500">Créneaux cette semaine</p>
          <p className="text-2xl font-bold text-[#22209C]">{creneaux.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-sm text-gray-500">Réservations</p>
          <p className="text-2xl font-bold text-green-600">{reservations.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-sm text-gray-500">Participants</p>
          <p className="text-2xl font-bold text-amber-600">
            {reservations.reduce((sum, r) => sum + r.participants, 0)}
          </p>
        </div>
      </div>

      {/* Navigation semaine */}
      <div className="flex items-center justify-between bg-white rounded-lg p-4 border">
        <button
          onClick={() => setWeekOffset(weekOffset - 1)}
          className="p-2 rounded-lg border hover:bg-gray-100"
        >
          <ChevronLeft size={24} />
        </button>
        <span className="font-medium">
          Semaine du {format(startOfWeek, 'd MMMM yyyy', { locale: fr })}
        </span>
        <button
          onClick={() => setWeekOffset(weekOffset + 1)}
          className="p-2 rounded-lg border hover:bg-gray-100"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Liste des créneaux par jour */}
      <div className="space-y-4">
        {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek, i)).map((jour) => {
          const jourStr = format(jour, 'yyyy-MM-dd')
          const creneauxJour = creneauxParJour[jourStr] || []

          return (
            <div key={jourStr} className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h3 className="font-semibold">
                  {format(jour, 'EEEE d MMMM', { locale: fr })}
                </h3>
              </div>
              
              {creneauxJour.length > 0 ? (
                <div className="divide-y">
                  {creneauxJour.map((c) => {
                    const resaCreneau = getReservationsCreneau(c.id)
                    const placesRestantes = c.placesMax - c.placesReservees
                    
                    return (
                      <div key={c.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-xl font-bold text-[#22209C]">{c.heure}</p>
                          </div>
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              <MapPin size={14} className="text-gray-400" />
                              {LIEUX[c.lieu].nom}
                            </p>
                            <p className="text-sm text-gray-500">{LIEUX[c.lieu].adresse}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users size={16} className={placesRestantes > 0 ? 'text-green-500' : 'text-red-500'} />
                            <span className={`text-sm ${placesRestantes > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {c.placesReservees}/{c.placesMax} places
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {resaCreneau.length > 0 && (
                            <button
                              onClick={() => setSelectedCreneau(c)}
                              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Voir réservations ({resaCreneau.length})
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCreneau(c.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="p-4 text-gray-400 text-sm">Aucun créneau</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal création créneau */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Nouveau créneau</h3>
            
            <form onSubmit={handleCreateCreneau} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={newCreneau.date}
                  onChange={(e) => setNewCreneau({ ...newCreneau, date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure</label>
                <input
                  type="time"
                  required
                  value={newCreneau.heure}
                  onChange={(e) => setNewCreneau({ ...newCreneau, heure: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
                <select
                  value={newCreneau.lieu}
                  onChange={(e) => setNewCreneau({ ...newCreneau, lieu: e.target.value as 'ecouffes' | 'printemps' })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="ecouffes">{LIEUX.ecouffes.nom}</option>
                  <option value="printemps">{LIEUX.printemps.nom}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Places max</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={10}
                  value={newCreneau.placesMax}
                  onChange={(e) => setNewCreneau({ ...newCreneau, placesMax: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg hover:bg-[#1a1878] disabled:opacity-50"
                >
                  {saving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal détail réservations */}
      {selectedCreneau && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Réservations</h3>
              <button onClick={() => setSelectedCreneau(null)} className="text-gray-500 hover:text-black">
                ✕
              </button>
            </div>
            
            <div className="bg-[#22209C]/5 rounded-lg p-3 mb-4">
              <p className="font-medium text-[#22209C]">
                {format(parseISO(selectedCreneau.date), 'EEEE d MMMM yyyy', { locale: fr })} à {selectedCreneau.heure}
              </p>
              <p className="text-sm text-gray-600">{LIEUX[selectedCreneau.lieu].nom}</p>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {getReservationsCreneau(selectedCreneau.id).map((r) => (
                <div key={r.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{r.nom}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${r.paye ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.paye ? 'Payé' : 'En attente'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{r.email}</p>
                  <p className="text-sm text-gray-600">{r.telephone}</p>
                  <p className="text-sm text-[#22209C] font-medium mt-1">
                    {r.participants} participant{r.participants > 1 ? 's' : ''} • {r.participants * 20}€
                  </p>
                </div>
              ))}
              
              {getReservationsCreneau(selectedCreneau.id).length === 0 && (
                <p className="text-gray-400 text-center py-4">Aucune réservation</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}