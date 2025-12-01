// app/ateliers/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { format, addDays, isSameDay, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { MapPin, Clock, Users, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'

type Creneau = {
  id: string
  date: string
  heure: string
  lieu: 'ecouffes' | 'printemps'
  placesMax: number
  placesReservees: number
}

type Lieu = {
  id: 'ecouffes' | 'printemps'
  nom: string
  adresse: string
  description: string
}

const LIEUX: Lieu[] = [
  {
    id: 'ecouffes',
    nom: 'Boutique Nouvelle Rive',
    adresse: '8 rue des Écouffes, 75004 Paris',
    description: 'Notre boutique intimiste au cœur du Marais',
  },
  {
    id: 'printemps',
    nom: 'Printemps Haussmann',
    adresse: '64 Boulevard Haussmann, 75009 Paris',
    description: 'Sous l\'historique coupole Binet, 7ème étage',
  },
]

export default function AteliersPage() {
  const [selectedLieu, setSelectedLieu] = useState<'ecouffes' | 'printemps' | null>(null)
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [selectedCreneau, setSelectedCreneau] = useState<Creneau | null>(null)
  const [loading, setLoading] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  
  // Formulaire réservation
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    participants: 1,
  })
  const [submitting, setSubmitting] = useState(false)

  // Charger les créneaux
  useEffect(() => {
    if (selectedLieu) {
      loadCreneaux()
    }
  }, [selectedLieu, weekOffset])

  const loadCreneaux = async () => {
    if (!selectedLieu) return
    setLoading(true)
    try {
      const startDate = addDays(new Date(), weekOffset * 7)
      const endDate = addDays(startDate, 7)
      const res = await fetch(`/api/ateliers/creneaux?lieu=${selectedLieu}&start=${startDate.toISOString()}&end=${endDate.toISOString()}`)
      if (res.ok) {
        const data = await res.json()
        setCreneaux(data.creneaux || [])
      }
    } catch (err) {
      console.error('Erreur chargement créneaux', err)
    } finally {
      setLoading(false)
    }
  }

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCreneau) return
    
    setSubmitting(true)
    try {
      const res = await fetch('/api/ateliers/reserver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creneauId: selectedCreneau.id,
          ...formData,
        }),
      })
      
      if (res.ok) {
        const data = await res.json()
        // Rediriger vers Stripe pour paiement
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl
        } else {
          alert('Réservation confirmée ! Vous recevrez un email de confirmation.')
          setShowForm(false)
          setSelectedCreneau(null)
          setFormData({ nom: '', email: '', telephone: '', participants: 1 })
          loadCreneaux()
        }
      } else {
        const error = await res.json()
        alert(error.error || 'Erreur lors de la réservation')
      }
    } catch (err) {
      alert('Erreur lors de la réservation')
    } finally {
      setSubmitting(false)
    }
  }

  // Grouper créneaux par jour
  const creneauxParJour = creneaux.reduce((acc, c) => {
    const jour = c.date.split('T')[0]
    if (!acc[jour]) acc[jour] = []
    acc[jour].push(c)
    return acc
  }, {} as Record<string, Creneau[]>)

  // Jours de la semaine
  const startOfWeek = addDays(new Date(), weekOffset * 7)
  const jours = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek, i))

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#22209C] to-[#1a1878] text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            ATELIER UPCYCLING
          </h1>
          <p className="text-xl md:text-2xl text-white/80 mb-6">
            // COLLIER // BRACELET // BOUCLES D'OREILLES
          </p>
          
          <div className="grid md:grid-cols-4 gap-4 text-sm mt-10">
            <div className="bg-white/10 rounded-lg p-4">
              <Sparkles className="mx-auto mb-2" size={28} />
              <p className="font-semibold">Choisis ton starter pack</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <Sparkles className="mx-auto mb-2" size={28} />
              <p className="font-semibold">Choisis tes pendants</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <Sparkles className="mx-auto mb-2" size={28} />
              <p className="font-semibold">Confectionne ton bijou</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <Sparkles className="mx-auto mb-2" size={28} />
              <p className="font-semibold">Slay en queen unique !</p>
            </div>
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <p className="text-gray-700 leading-relaxed mb-6">
            Des <strong>Créatrices Bijoux</strong> vous accompagnent pour imaginer et assembler votre propre pièce unique, 
            un bijou personnalisé à partir de breloques et autres pièces chinées, perles anciennes, 
            pièces vintage, boutons de luxe et autres trésors.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            Pendant <strong>45 minutes</strong>, vous explorez notre sélection et sélectionnez celles qui vous correspondent 
            pour confectionner un collier, un bracelet ou des boucles d'oreilles uniques. 
            Les créatrices vous apprennent à jouer avec les formes puis à manipuler les pinces de base de la bijouterie.
          </p>
          
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 bg-[#22209C]/10 text-[#22209C] px-4 py-2 rounded-full">
              <Clock size={16} />
              <span>45 minutes</span>
            </div>
            <div className="flex items-center gap-2 bg-[#22209C]/10 text-[#22209C] px-4 py-2 rounded-full">
              <Users size={16} />
              <span>Jusqu'à 4 personnes</span>
            </div>
            <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full">
              <span>Pack de départ : 5 à 20 €</span>
            </div>
            <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full">
              <span>Breloques : 3 à 40 €</span>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              💎 Acompte de 20€ à la réservation, déduit du prix de votre bijou !
            </p>
          </div>
        </div>
      </section>

      {/* Sélection du lieu */}
      <section className="max-w-4xl mx-auto py-8 px-6">
        <h2 className="text-2xl font-bold text-center mb-8 text-[#22209C]">
          Choisissez votre lieu
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {LIEUX.map((lieu) => (
            <button
              key={lieu.id}
              onClick={() => {
                setSelectedLieu(lieu.id)
                setSelectedCreneau(null)
                setWeekOffset(0)
              }}
              className={`text-left p-6 rounded-xl border-2 transition-all ${
                selectedLieu === lieu.id
                  ? 'border-[#22209C] bg-[#22209C]/5 shadow-lg'
                  : 'border-gray-200 bg-white hover:border-[#22209C]/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <MapPin className={`mt-1 ${selectedLieu === lieu.id ? 'text-[#22209C]' : 'text-gray-400'}`} size={24} />
                <div>
                  <h3 className="font-bold text-lg">{lieu.nom}</h3>
                  <p className="text-gray-600 text-sm">{lieu.adresse}</p>
                  <p className="text-gray-500 text-sm mt-2">{lieu.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Calendrier des créneaux */}
      {selectedLieu && (
        <section className="max-w-4xl mx-auto py-8 px-6">
          <h2 className="text-2xl font-bold text-center mb-8 text-[#22209C]">
            Choisissez votre créneau
          </h2>
          
          {/* Navigation semaine */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
              disabled={weekOffset === 0}
              className="p-2 rounded-lg border hover:bg-gray-100 disabled:opacity-30"
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

          {/* Grille des jours */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C] mx-auto"></div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {jours.map((jour) => {
                const jourStr = format(jour, 'yyyy-MM-dd')
                const creneauxJour = creneauxParJour[jourStr] || []
                const isToday = isSameDay(jour, new Date())
                const isPast = jour < new Date() && !isToday
                
                return (
                  <div
                    key={jourStr}
                    className={`rounded-lg border p-3 min-h-[120px] ${
                      isPast ? 'bg-gray-100 opacity-50' : 'bg-white'
                    } ${isToday ? 'border-[#22209C] border-2' : 'border-gray-200'}`}
                  >
                    <div className="text-center mb-2">
                      <p className="text-xs text-gray-500 uppercase">
                        {format(jour, 'EEE', { locale: fr })}
                      </p>
                      <p className={`text-lg font-bold ${isToday ? 'text-[#22209C]' : ''}`}>
                        {format(jour, 'd')}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      {creneauxJour.map((c) => {
                        const placesRestantes = c.placesMax - c.placesReservees
                        const isDisabled = placesRestantes <= 0 || isPast
                        const isSelected = selectedCreneau?.id === c.id
                        
                        return (
                          <button
                            key={c.id}
                            onClick={() => !isDisabled && setSelectedCreneau(c)}
                            disabled={isDisabled}
                            className={`w-full text-xs p-1.5 rounded transition-all ${
                              isSelected
                                ? 'bg-[#22209C] text-white'
                                : isDisabled
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-[#22209C]/10 text-[#22209C] hover:bg-[#22209C]/20'
                            }`}
                          >
                            <span className="font-medium">{c.heure}</span>
                            <br />
                            <span className="text-[10px]">
                              {placesRestantes > 0 ? `${placesRestantes} place${placesRestantes > 1 ? 's' : ''}` : 'Complet'}
                            </span>
                          </button>
                        )
                      })}
                      
                      {creneauxJour.length === 0 && !isPast && (
                        <p className="text-xs text-gray-400 text-center">—</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Créneau sélectionné */}
          {selectedCreneau && (
            <div className="mt-8 p-6 bg-white rounded-xl border-2 border-[#22209C] shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">Créneau sélectionné</p>
                  <p className="text-xl font-bold text-[#22209C]">
                    {format(parseISO(selectedCreneau.date), 'EEEE d MMMM', { locale: fr })} à {selectedCreneau.heure}
                  </p>
                  <p className="text-sm text-gray-600">
                    {LIEUX.find(l => l.id === selectedCreneau.lieu)?.nom}
                  </p>
                </div>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-6 py-3 bg-[#22209C] text-white font-semibold rounded-lg hover:bg-[#1a1878] transition"
                >
                  Réserver — 20€ d'acompte
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Modal de réservation */}
      {showForm && selectedCreneau && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Finaliser la réservation</h3>
            
            <div className="bg-[#22209C]/5 rounded-lg p-4 mb-6">
              <p className="font-medium text-[#22209C]">
                {format(parseISO(selectedCreneau.date), 'EEEE d MMMM yyyy', { locale: fr })} à {selectedCreneau.heure}
              </p>
              <p className="text-sm text-gray-600">
                {LIEUX.find(l => l.id === selectedCreneau.lieu)?.adresse}
              </p>
            </div>
            
            <form onSubmit={handleReservation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#22209C] focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#22209C] focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                <input
                  type="tel"
                  required
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#22209C] focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de participants (max {selectedCreneau.placesMax - selectedCreneau.placesReservees})
                </label>
                <select
                  value={formData.participants}
                  onChange={(e) => setFormData({ ...formData, participants: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#22209C] focus:border-transparent"
                >
                  {Array.from({ length: selectedCreneau.placesMax - selectedCreneau.placesReservees }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} personne{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Acompte : {formData.participants * 20}€</strong>
                  <br />
                  Ce montant sera déduit du prix de votre bijou le jour de l'atelier.
                </p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg hover:bg-[#1a1878] disabled:opacity-50"
                >
                  {submitting ? 'Traitement...' : `Payer ${formData.participants * 20}€`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}