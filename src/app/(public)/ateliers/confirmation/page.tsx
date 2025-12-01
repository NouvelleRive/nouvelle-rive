// app/ateliers/confirmation/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Calendar, MapPin, Clock } from 'lucide-react'

export default function ConfirmationPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)
  const [reservation, setReservation] = useState<any>(null)

  useEffect(() => {
    if (sessionId) {
      // On pourrait récupérer les détails de la réservation ici
      // Pour l'instant on affiche juste la confirmation
      setLoading(false)
    }
  }, [sessionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] py-16 px-6">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-600" size={48} />
          </div>
          
          <h1 className="text-2xl font-bold text-[#22209C] mb-2">
            Réservation confirmée !
          </h1>
          
          <p className="text-gray-600 mb-6">
            Merci pour votre réservation. Vous recevrez un email de confirmation avec tous les détails.
          </p>
          
          <div className="bg-[#22209C]/5 rounded-lg p-6 mb-6 text-left">
            <h2 className="font-semibold text-[#22209C] mb-4">Informations pratiques</h2>
            
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-start gap-3">
                <Clock size={18} className="text-[#22209C] mt-0.5" />
                <div>
                  <p className="font-medium">Durée de l'atelier</p>
                  <p className="text-gray-500">45 minutes</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <MapPin size={18} className="text-[#22209C] mt-0.5" />
                <div>
                  <p className="font-medium">Arrivez 5 minutes avant</p>
                  <p className="text-gray-500">Pour vous installer tranquillement</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar size={18} className="text-[#22209C] mt-0.5" />
                <div>
                  <p className="font-medium">Votre acompte de 20€</p>
                  <p className="text-gray-500">Sera déduit du prix de votre bijou</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-amber-800">
              <strong>Annulation :</strong> Vous pouvez annuler gratuitement jusqu'à 24h avant l'atelier en nous contactant par email.
            </p>
          </div>
          
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[#22209C] text-white font-semibold rounded-lg hover:bg-[#1a1878] transition"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}