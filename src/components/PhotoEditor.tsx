// components/PhotoEditor.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, RotateCcw, RotateCw, Check } from 'lucide-react'

interface PhotoEditorProps {
  imageUrl: string
  onConfirm: (processedUrl: string) => void
  onCancel: () => void
}

export default function PhotoEditor({ imageUrl, onConfirm, onCancel }: PhotoEditorProps) {
  const [processing, setProcessing] = useState(false)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)

  // URL avec rotation appliquée
  const getRotatedUrl = (url: string, deg: number) => {
    if (deg === 0) return url
    const urlParts = url.split('/upload/')
    if (urlParts.length !== 2) return url
    return `${urlParts[0]}/upload/a_${deg}/${urlParts[1]}`
  }

  const currentDisplayUrl = getRotatedUrl(imageUrl, rotation)

  // Lancer le détourage
  const handleAutoRemove = async () => {
    setProcessing(true)
    setError(null)

    try {
      // Envoyer l'URL avec rotation
      const urlToProcess = getRotatedUrl(imageUrl, rotation)
      
      const res = await fetch('/api/detourage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: urlToProcess }),
      })

      const data = await res.json()

      if (data.success && data.maskUrl) {
        setProcessedUrl(data.maskUrl)
      } else {
        setError(data.error || 'Erreur lors du détourage')
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau')
    } finally {
      setProcessing(false)
    }
  }

  // Rotation
  const handleRotate = (direction: 'left' | 'right') => {
    setRotation(prev => {
      const newRot = direction === 'right' ? prev + 90 : prev - 90
      return ((newRot % 360) + 360) % 360
    })
    // Reset le résultat si on tourne après détourage
    if (processedUrl) {
      setProcessedUrl(null)
    }
  }

  const handleConfirm = () => {
    if (processedUrl) {
      onConfirm(processedUrl)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {processing ? '⏳ Détourage...' : error ? '❌ Erreur' : processedUrl ? '✨ Résultat' : '📸 Photo'}
          </h2>
          <button
            onClick={onCancel}
            disabled={processing}
            className="p-2 hover:bg-gray-100 rounded-full transition disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Image */}
        <div className="p-4">
          <div className="relative aspect-square bg-white rounded-xl overflow-hidden border">
            <img
              src={processedUrl || currentDisplayUrl}
              alt="Photo"
              className="absolute inset-0 w-full h-full object-contain"
            />

            {/* Loading overlay */}
            {processing && (
              <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#22209C] border-t-transparent mb-4" />
                <p className="text-gray-600 font-medium">Détourage en cours...</p>
                <p className="text-gray-400 text-sm mt-1">~5 secondes</p>
              </div>
            )}
          </div>

          {/* Rotation buttons - only before processing */}
          {!processedUrl && !processing && (
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => handleRotate('left')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              >
                <RotateCcw size={18} />
                Gauche
              </button>
              <button
                onClick={() => handleRotate('right')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              >
                <RotateCw size={18} />
                Droite
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-gray-50">
          {processing ? (
            <div className="text-center text-gray-500 text-sm py-2">
              Veuillez patienter...
            </div>
          ) : error ? (
            <button
              onClick={handleAutoRemove}
              className="w-full flex items-center justify-center gap-2 bg-[#22209C] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition"
            >
              <RotateCcw size={18} />
              Réessayer
            </button>
          ) : processedUrl ? (
            <div className="flex gap-3">
              <button
                onClick={() => { setProcessedUrl(null); setRotation(0) }}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-100 transition"
              >
                <RotateCcw size={18} />
                Recommencer
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
              >
                <Check size={20} />
                Valider
              </button>
            </div>
          ) : (
            <button
              onClick={handleAutoRemove}
              className="w-full flex items-center justify-center gap-2 bg-[#22209C] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition"
            >
              Détourer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}