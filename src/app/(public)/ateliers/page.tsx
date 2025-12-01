// app/(public)/ateliers/page.tsx
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Lieu = 'printemps' | 'ecouffes'

type Creneau = {
  id: string
  date: string
  heure: string
  lieu: Lieu
  placesMax: number
  placesReservees: number
}

const LIEUX = {
  printemps: {
    nom: 'Printemps Haussmann',
    adresse: '64 Boulevard Haussmann, 75009 Paris',
    detail: '7ᵉ étage, sous la coupole Binet',
  },
  ecouffes: {
    nom: 'NOUVELLE RIVE',
    adresse: '8 rue des Écouffes, 75004 Paris',
    detail: 'Le Marais',
  },
}

export default function AteliersPage() {
  const [selectedLieu, setSelectedLieu] = useState<Lieu>('printemps')
  const [creneaux, setCreneaux] = useState<Creneau[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const calendrierRef = useRef<HTMLDivElement>(null)
  
  // Modal réservation
  const [selectedCreneau, setSelectedCreneau] = useState<Creneau | null>(null)
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    participants: 1,
  })
  const [submitting, setSubmitting] = useState(false)

  // Calculer les dates de la semaine
  const weekDates = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7)
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      return date
    })
  }, [weekOffset])

  // Charger les créneaux
  useEffect(() => {
    const fetchCreneaux = async () => {
      setLoading(true)
      try {
        const start = weekDates[0].toISOString().split('T')[0]
        const end = weekDates[6].toISOString().split('T')[0]
        
        const res = await fetch(`/api/ateliers/creneaux?lieu=${selectedLieu}&start=${start}&end=${end}`)
        const data = await res.json()
        
        if (data.success) {
          setCreneaux(data.creneaux || [])
        }
      } catch (err) {
        console.error('Erreur chargement créneaux:', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchCreneaux()
  }, [selectedLieu, weekDates])

  // Scroll vers calendrier quand on sélectionne un lieu
  const handleSelectLieu = (lieu: Lieu) => {
    setSelectedLieu(lieu)
    setTimeout(() => {
      calendrierRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  // Grouper créneaux par date
  const creneauxParDate = useMemo(() => {
    const map = new Map<string, Creneau[]>()
    creneaux.forEach(c => {
      const existing = map.get(c.date) || []
      map.set(c.date, [...existing, c])
    })
    return map
  }, [creneaux])

  // Formater date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const formatDateISO = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  // Soumettre réservation
  const handleSubmit = async () => {
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
      
      const data = await res.json()
      
      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        alert(data.error || 'Erreur lors de la réservation')
      }
    } catch (err) {
      alert('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const placesRestantes = selectedCreneau 
    ? selectedCreneau.placesMax - selectedCreneau.placesReservees 
    : 0

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="border-b border-black">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h1 
            className="text-4xl md:text-6xl font-bold tracking-tight mb-8"
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            ATELIER BIJOU UPCYCLÉ
          </h1>
          
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6 text-sm leading-relaxed" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
              <p>
                Au 7ᵉ étage du Printemps Haussmann, sous l'historique coupole Binet, des Créatrices Bijoux vous accompagnent pour imaginer et assembler votre propre pièce unique, un bijou personnalisé à partir de breloques et autres pièces chinées, perles anciennes, pièces vintage, boutons de luxe et autres trésors.
              </p>
              <p>
                Pendant 45 minutes, vous explorez notre sélection et sélectionnez celles qui vous correspondent pour confectionner un collier, un bracelet ou des boucles d'oreilles uniques. Les créatrices vous apprennent à jouer avec les formes puis à manipuler les pinces de base de la bijouterie.
              </p>
              <p>
                Vous repartez avec de nouvelles compétences et un bijou parfaitement fait pour vous qui raconte une histoire. L'atelier accueille jusqu'à 4 personnes, le cadeau idéal ?
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="border border-black p-6">
                <p className="text-xs tracking-widest mb-4">DÉROULÉ</p>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-4">
                    <span className="text-xs text-gray-500">#1</span>
                    <span>Choisissez votre starter pack</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-xs text-gray-500">#2</span>
                    <span>Explorez les breloques et pendants</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-xs text-gray-500">#3</span>
                    <span>Assemblez votre bijou unique</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-xs text-gray-500">#4</span>
                    <span>Repartez avec votre création</span>
                  </div>
                </div>
              </div>
              
              <div className="border border-black p-6">
                <p className="text-xs tracking-widest mb-4">TARIFS</p>
                <div className="space-y-2 text-sm">
                  <p>Starter pack : <strong>5 à 20 €</strong></p>
                  <p>Breloques : <strong>1 à 40 €</strong> (hors pièces de luxe)</p>
                  <p>Acompte réservation : <strong>20 €</strong> /pers.</p>
                  <p className="text-gray-400 italic text-xs mt-2">Tarif minimum, déduit du prix final de votre bijou upcyclé</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sélection lieu */}
      <div className="border-b border-black">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-xs tracking-widest mb-6">CHOISIR UN LIEU</p>
          
          <div className="grid md:grid-cols-2 gap-4">
            {(Object.keys(LIEUX) as Lieu[]).map((lieu) => (
              <button
                key={lieu}
                onClick={() => handleSelectLieu(lieu)}
                className={`text-left p-6 border transition-all ${
                  selectedLieu === lieu 
                    ? 'border-black bg-black text-white' 
                    : 'border-black hover:bg-gray-50'
                }`}
              >
                <p className="font-medium mb-1">{LIEUX[lieu].nom}</p>
                <p className="text-sm opacity-70">{LIEUX[lieu].detail}</p>
                <p className="text-xs mt-2 opacity-50">{LIEUX[lieu].adresse}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendrier */}
      <div ref={calendrierRef} className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs tracking-widest">CRÉNEAUX DISPONIBLES</p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="p-2 border border-black hover:bg-black hover:text-white transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="p-2 border border-black hover:bg-black hover:text-white transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border border-black border-t-transparent animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date) => {
              const dateStr = formatDateISO(date)
              const creneauxJour = creneauxParDate.get(dateStr) || []
              const isToday = dateStr === formatDateISO(new Date())
              const isPast = date < new Date(new Date().setHours(0, 0, 0, 0))
              
              return (
                <div 
                  key={dateStr} 
                  className={`border border-black p-3 min-h-[120px] ${isPast ? 'opacity-40' : ''}`}
                >
                  <p className={`text-xs mb-3 ${isToday ? 'font-bold' : ''}`}>
                    {formatDate(date)}
                  </p>
                  
                  <div className="space-y-1">
                    {creneauxJour.map((c) => {
                      const places = c.placesMax - c.placesReservees
                      const complet = places <= 0
                      
                      return (
                        <button
                          key={c.id}
                          onClick={() => !complet && !isPast && setSelectedCreneau(c)}
                          disabled={complet || isPast}
                          className={`w-full text-left text-xs p-2 border transition-all ${
                            complet 
                              ? 'border-gray-300 text-gray-400 cursor-not-allowed' 
                              : 'border-black hover:bg-black hover:text-white'
                          }`}
                        >
                          <span>{c.heure}</span>
                          {!complet && <span className="block text-[10px] opacity-60">{places} place{places > 1 ? 's' : ''}</span>}
                          {complet && <span className="block text-[10px]">complet</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {creneaux.length === 0 && !loading && (
          <p className="text-center text-sm text-gray-500 py-8">
            Aucun créneau disponible cette semaine
          </p>
        )}
      </div>

      {/* Modal réservation */}
      {selectedCreneau && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md border border-black max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-black sticky top-0 bg-white">
              <h3 className="text-sm tracking-widest">RÉSERVER</h3>
              <button 
                onClick={() => setSelectedCreneau(null)}
                className="text-2xl leading-none hover:opacity-50"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 border-b border-black">
              <p className="font-medium">{LIEUX[selectedCreneau.lieu].nom}</p>
              <p className="text-sm text-gray-600">
                {new Date(selectedCreneau.date).toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                })} à {selectedCreneau.heure}
              </p>
              <p className="text-xs text-gray-500 mt-1">{placesRestantes} place{placesRestantes > 1 ? 's' : ''} disponible{placesRestantes > 1 ? 's' : ''}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs tracking-widest mb-2">NOM</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full border border-black p-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              
              <div>
                <label className="block text-xs tracking-widest mb-2">EMAIL</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-black p-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              
              <div>
                <label className="block text-xs tracking-widest mb-2">TÉLÉPHONE</label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full border border-black p-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              
              <div>
                <label className="block text-xs tracking-widest mb-2">PARTICIPANTS</label>
                <select
                  value={formData.participants}
                  onChange={(e) => setFormData({ ...formData, participants: parseInt(e.target.value) })}
                  className="w-full border border-black p-3 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                >
                  {Array.from({ length: Math.min(4, placesRestantes) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} personne{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              
              <div className="border border-black p-4 bg-gray-50">
                <div className="flex justify-between text-sm">
                  <span>Acompte ({formData.participants} × 20€)</span>
                  <span className="font-medium">{formData.participants * 20}€</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Déduit du prix de votre bijou</p>
              </div>
              
              <button
                onClick={handleSubmit}
                disabled={!formData.nom || !formData.email || !formData.telephone || submitting}
                className="w-full py-4 bg-black text-white text-sm tracking-widest hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? '...' : 'PAYER L\'ACOMPTE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}