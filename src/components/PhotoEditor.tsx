// components/PhotoEditor.tsx
'use client'

import { useState } from 'react'
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

  // Protection si imageUrl est undefined
  if (!imageUrl) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 text-center">
          <p className="text-red-500 mb-4">Erreur : Aucune image fournie</p>
          <button onClick={onCancel} className="bg-gray-200 px-4 py-2 rounded">Fermer</button>
        </div>
      </div>
    )
  }

  const getRotatedUrl = (url: string, deg: number) => {
    if (deg === 0) return url
    const urlParts = url.split('/upload/')
    if (urlParts.length !== 2) return url
    return `${urlParts[0]}/upload/a_${deg}/${urlParts[1]}`
  }

  const currentDisplayUrl = getRotatedUrl(imageUrl, rotation)

  const handleAutoRemove = async () => {
    setProcessing(true)
    setError(null)

    try {
      const baseImageUrl = imageUrl
        .replace(/\/upload\/a_\d+\//, '/upload/')
        .replace(/\/upload\/a_exif\//, '/upload/')

      const res = await fetch('/api/detourage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: baseImageUrl, rotation }),
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

  const handleRotate = (direction: 'left' | 'right') => {
    setRotation(prev => {
      const newRot = direction === 'right' ? prev + 90 : prev - 90
      return ((newRot % 360) + 360) % 360
    })
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
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {processing ? '⏳ Détourage...' : error ? '❌ Erreur' : processedUrl ? '✅ Résultat' : '📷 Éditer la photo'}
          </h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden mb-4">
            <img
              src={processedUrl || currentDisplayUrl}
              alt="Aperçu"
              className="w-full h-full object-contain"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {!processedUrl && !processing && (
            <div className="flex justify-center gap-4 mb-4">
              <button
                onClick={() => handleRotate('left')}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                <RotateCcw size={18} /> Gauche
              </button>
              <button
                onClick={() => handleRotate('right')}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                <RotateCw size={18} /> Droite
              </button>
            </div>
          )}

          {processing ? (
            <div className="text-center text-gray-500 text-sm py-2">
              Veuillez patienter...
            </div>
          ) : error ? (
            <button
              onClick={handleAutoRemove}
              className="w-full flex items-center justify-center gap-2 bg-[#22209C] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition"
            >
              <RotateCcw size={18} /> Réessayer
            </button>
          ) : processedUrl ? (
            <div className="flex gap-3">
              <button
                onClick={() => { setProcessedUrl(null); setRotation(0) }}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-100 transition"
              >
                <RotateCcw size={18} /> Recommencer
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
              >
                <Check size={20} /> Valider
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
