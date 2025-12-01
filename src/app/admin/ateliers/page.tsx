// app/admin/ateliers/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Calendar, Users } from 'lucide-react'

type Lieu = 'printemps' | 'ecouffes'
type Animatrice = 'INES PINEAU' | 'TÊTE D\'ORANGE' | 'ARCHIVE.S' | 'GIGI PARIS'

type Creneau = {
  id: string
  date: string
  heure: string
  lieu: Lieu
  animatrice: Animatrice
  placesMax: number
  placesReservees: number
  reservations?: Reservation[]
}

type Reservation = {
  id: string
  nom: string
  email: string
  telephone: string
  participants: number
  paye: boolean
  createdAt: string
}

const LIEUX: { id: Lieu; nom: string }[] = [
  { id: 'printemps', nom: 'Printemps Haussmann' },
  { id: 'ecouffes', nom: 'NOUVELLE RIVE' },
]

const ANIMATRICES: Animatrice[] = [
  'INES PINEAU',
  'TÊTE D\'ORANGE',
  'ARCHIVE.S',
  'GIGI PARIS',
]

export default function AdminAteliersPage() {
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedCreneau, setSelectedCreneau] = useState<Creneau | null>(null)
  
  // Filtres
  const [filterLieu, setFilterLieu] = useState<Lieu | 'all'>('all')
  const [filterAnimatrice, setFilterAnimatrice] = useState<Animatrice | 'all'>('all')
  
  // Form
  const [formData, setFormData] = useState({
    date: '',
    heure: '14:00',
    lieu: 'printemps' as Lieu,
    animatrice: 'INES PINEAU' as Animatrice,
    placesMax: 4,
  })
  const [submitting, setSubmitting] = useState(false)

  // Charger les créneaux
  const loadCreneaux = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ateliers/admin/creneaux')
      const data = await res.json()
      if (data.success) {
        setCreneaux(data.creneaux || [])
      }
    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCreneaux()
  }, [])

  // Créer un créneau
  const handleSubmit = async () => {
    if (!formData.date || !formData.heure) return
    
    setSubmitting(true)
    try {
      const res = await fetch('/api/ateliers/admin/creneaux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      const data = await res.json()
      if (data.success) {
        setShowModal(false)
        setFormData({
          date: '',
          heure: '14:00',
          lieu: 'printemps',
          animatrice: 'INES PINEAU',
          placesMax: 4,
        })
        loadCreneaux()
      } else {
        alert(data.error || 'Erreur')
      }
    } catch (err) {
      alert('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  // Supprimer un créneau
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce créneau ?')) return
    
    try {
      const res = await fetch('/api/ateliers/admin/creneaux', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      
      const data = await res.json()
      if (data.success) {
        loadCreneaux()
      } else {
        alert(data.error || 'Erreur')
      }
    } catch (err) {
      alert('Erreur')
    }
  }

  // Filtrer
  const creneauxFiltres = creneaux.filter(c => {
    if (filterLieu !== 'all' && c.lieu !== filterLieu) return false
    if (filterAnimatrice !== 'all' && c.animatrice !== filterAnimatrice) return false
    return true
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  // Stats
  const stats = {
    total: creneaux.length,
    aVenir: creneaux.filter(c => new Date(c.date) >= new Date(new Date().setHours(0,0,0,0))).length,
    reservations: creneaux.reduce((sum, c) => sum + (c.placesReservees || 0), 0),
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#22209C] border-t-transparent animate-spin rounded-full"></div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ateliers</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#22209C] text-white text-sm rounded hover:opacity-90"
        >
          <Plus size={16} />
          Nouveau créneau
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Calendar size={16} />
            <span className="text-sm">Total créneaux</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Calendar size={16} />
            <span className="text-sm">À venir</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.aVenir}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Users size={16} />
            <span className="text-sm">Réservations</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.reservations}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-4 mb-6">
        <select
          value={filterLieu}
          onChange={(e) => setFilterLieu(e.target.value as Lieu | 'all')}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">Tous les lieux</option>
          {LIEUX.map(l => (
            <option key={l.id} value={l.id}>{l.nom}</option>
          ))}
        </select>
        
        <select
          value={filterAnimatrice}
          onChange={(e) => setFilterAnimatrice(e.target.value as Animatrice | 'all')}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">Toutes les animatrices</option>
          {ANIMATRICES.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Liste des créneaux */}
      <div className="space-y-3">
        {creneauxFiltres.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucun créneau</p>
        ) : (
          creneauxFiltres.map((creneau) => {
            const places = creneau.placesMax - creneau.placesReservees
            const isPast = new Date(creneau.date) < new Date(new Date().setHours(0, 0, 0, 0))
            
            return (
              <div
                key={creneau.id}
                className={`bg-white border rounded-lg p-4 ${isPast ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{formatDate(creneau.date)} à {creneau.heure}</p>
                    <p className="text-sm text-gray-600">
                      {LIEUX.find(l => l.id === creneau.lieu)?.nom}
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Animatrice :</span> {creneau.animatrice}
                    </p>
                    <p className="text-sm">
                      <span className={places === 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                        {creneau.placesReservees}/{creneau.placesMax} places réservées
                      </span>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedCreneau(creneau)}
                      className="px-3 py-1 border border-[#22209C] text-[#22209C] text-sm rounded hover:bg-[#22209C] hover:text-white transition-all"
                    >
                      Détails
                    </button>
                    <button
                      onClick={() => handleDelete(creneau.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal création */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-xl">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-semibold text-lg">Nouveau créneau</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Heure</label>
                <input
                  type="time"
                  value={formData.heure}
                  onChange={(e) => setFormData({ ...formData, heure: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Lieu</label>
                <select
                  value={formData.lieu}
                  onChange={(e) => setFormData({ ...formData, lieu: e.target.value as Lieu })}
                  className="w-full border rounded px-3 py-2"
                >
                  {LIEUX.map(l => (
                    <option key={l.id} value={l.id}>{l.nom}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Animatrice</label>
                <select
                  value={formData.animatrice}
                  onChange={(e) => setFormData({ ...formData, animatrice: e.target.value as Animatrice })}
                  className="w-full border rounded px-3 py-2"
                >
                  {ANIMATRICES.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Places max</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.placesMax}
                  onChange={(e) => setFormData({ ...formData, placesMax: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            
            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border rounded hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.date || submitting}
                className="flex-1 py-2 bg-[#22209C] text-white rounded hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? '...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal détails réservations */}
      {selectedCreneau && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-semibold text-lg">Réservations</h3>
              <button onClick={() => setSelectedCreneau(null)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            
            <div className="p-6 border-b bg-gray-50">
              <p className="font-medium">{formatDate(selectedCreneau.date)} à {selectedCreneau.heure}</p>
              <p className="text-sm text-gray-600">{LIEUX.find(l => l.id === selectedCreneau.lieu)?.nom}</p>
              <p className="text-sm text-gray-600">Animatrice : {selectedCreneau.animatrice}</p>
            </div>
            
            <div className="p-6">
              {!selectedCreneau.reservations || selectedCreneau.reservations.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Aucune réservation</p>
              ) : (
                <div className="space-y-4">
                  {selectedCreneau.reservations.map((r) => (
                    <div key={r.id} className="border rounded-lg p-4">
                      <p className="font-medium">{r.nom}</p>
                      <p className="text-sm text-gray-600">{r.email}</p>
                      <p className="text-sm text-gray-600">{r.telephone}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm">{r.participants} participant{r.participants > 1 ? 's' : ''}</span>
                        {r.paye && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Payé</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}