// src/components/PhotoEditor.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Check, RotateCcw, Loader2, MousePointer2, Eraser } from 'lucide-react'

interface Point {
  x: number
  y: number
  label: number // 1 = inclure, 0 = exclure
}

interface PhotoEditorProps {
  imageUrl: string
  onConfirm: (processedUrl: string) => void
  onCancel: () => void
}

export default function PhotoEditor({ imageUrl, onConfirm, onCancel }: PhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })

  // Charger l'image dans le canvas
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height })
      
      const maxSize = 500
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const displayWidth = img.width * ratio
      const displayHeight = img.height * ratio
      setDisplaySize({ width: displayWidth, height: displayHeight })
      
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = displayWidth
        canvas.height = displayHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, displayWidth, displayHeight)
        }
      }
    }
    img.src = imageUrl
  }, [imageUrl])

  // Redessiner avec les points
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || displaySize.width === 0) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, displaySize.width, displaySize.height)
      
      points.forEach((point) => {
        const displayX = (point.x / imageSize.width) * displaySize.width
        const displayY = (point.y / imageSize.height) * displaySize.height
        
        ctx.beginPath()
        ctx.arc(displayX, displayY, 8, 0, 2 * Math.PI)
        ctx.fillStyle = point.label === 1 ? '#22c55e' : '#ef4444'
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        ctx.stroke()
        
        ctx.fillStyle = 'white'
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(point.label === 1 ? '+' : '-', displayX, displayY)
      })
    }
    img.src = previewUrl || imageUrl
  }, [points, imageUrl, previewUrl, imageSize, displaySize])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || loading) return

    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    
    const imageX = Math.round((clickX / displaySize.width) * imageSize.width)
    const imageY = Math.round((clickY / displaySize.height) * imageSize.height)

    setPoints(prev => [...prev, { x: imageX, y: imageY, label: mode === 'add' ? 1 : 0 }])
    setError(null)
  }

  const handleSegment = async () => {
    if (points.length === 0) {
      setError('Cliquez sur le vêtement pour le sélectionner')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/segment-sam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, points })
      })

      const data = await response.json()

      if (data.success && data.maskUrl) {
        // Utiliser directement l'URL retournée par l'API (déjà avec fond blanc)
        setPreviewUrl(data.maskUrl)
      } else {
        throw new Error(data.error || 'Erreur segmentation')
      }
    } catch (err: any) {
      console.error('Erreur segmentation:', err)
      setError(err.message || 'Erreur lors de la segmentation')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setPoints([])
    setPreviewUrl(null)
    setError(null)
  }

  const handleConfirm = () => {
    if (previewUrl) {
      onConfirm(previewUrl)
    } else {
      // Pas de détourage, garder l'original avec transformations basiques
      const urlParts = imageUrl.split('/upload/')
      if (urlParts.length === 2) {
        const finalUrl = `${urlParts[0]}/upload/b_white,c_pad,ar_1:1,w_1200,h_1200,e_sharpen:30,q_auto:good,f_auto/${urlParts[1]}`
        onConfirm(finalUrl)
      } else {
        onConfirm(imageUrl)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900">Détourer la photo</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {previewUrl 
            ? "Vérifiez le résultat. Pas satisfait ? Recommencez."
            : "Cliquez sur le vêtement pour le sélectionner."
          }
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('add')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
              mode === 'add' 
                ? 'bg-green-100 text-green-700 border-2 border-green-500' 
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <MousePointer2 size={16} /> Garder
          </button>
          <button
            onClick={() => setMode('remove')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
              mode === 'remove' 
                ? 'bg-red-100 text-red-700 border-2 border-red-500' 
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Eraser size={16} /> Enlever
          </button>
        </div>

        {/* Canvas */}
        <div className="flex justify-center mb-4 bg-gray-100 rounded-lg p-2">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="cursor-crosshair rounded-lg max-w-full"
            style={{ maxHeight: '400px' }}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        {points.length > 0 && !previewUrl && (
          <p className="text-xs text-gray-400 mb-4">
            {points.length} point(s) sélectionné(s)
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={loading || (points.length === 0 && !previewUrl)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw size={16} /> Recommencer
          </button>
          
          {!previewUrl ? (
            <button
              onClick={handleSegment}
              disabled={loading || points.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#22209C] text-white rounded-lg hover:bg-[#1a1875] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Détourage...
                </>
              ) : (
                'Détourer'
              )}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Check size={16} /> Valider
            </button>
          )}
        </div>

        {/* Option passer sans détourage */}
        {!previewUrl && (
          <button
            onClick={handleConfirm}
            className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            Passer sans détourer →
          </button>
        )}
      </div>
    </div>
  )
}