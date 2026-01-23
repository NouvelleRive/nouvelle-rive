// components/PhotoEditor.tsx
'use client'

import { useState, useRef } from 'react'
import { X, RotateCcw, RotateCw, Check, Eraser } from 'lucide-react'

interface PhotoEditorProps {
  imageUrl: string
  onConfirm: (processedUrl: string) => void
  onCancel: () => void
}

export default function PhotoEditor({ imageUrl, onConfirm, onCancel }: PhotoEditorProps) {
  const [processing, setProcessing] = useState(false)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [rawUrl, setRawUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const [mode, setMode] = useState<'view' | 'erase'>('view')
  const [brushSize, setBrushSize] = useState(30)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [canvasReady, setCanvasReady] = useState(false)
  const [canvasHistory, setCanvasHistory] = useState<ImageData[]>([])

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
  if (!url || deg === 0) return url || ''
  const urlParts = url.split('/upload/')
  if (urlParts.length !== 2) return url
  return `${urlParts[0]}/upload/a_${deg}/${urlParts[1]}`
}

  const currentDisplayUrl = getRotatedUrl(processedUrl || imageUrl, processedUrl ? 0 : rotation)

  const initCanvas = () => {
  const canvas = canvasRef.current
  const urlToLoad = processedUrl || imageUrl
  
  if (!canvas || !urlToLoad) {
      console.error('Canvas ou URL manquant', { canvas: !!canvas, urlToLoad })
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        setCanvasReady(true)
        // Sauvegarder l'état initial
      const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setCanvasHistory([initialState])
      }
    }
    img.onerror = (err) => {
      console.error('Erreur chargement image canvas:', err)
      setError('Impossible de charger l\'image pour la gomme')
    }
    img.src = urlToLoad
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (mode !== 'erase') return
    setIsDrawing(true)
    draw(e)
  }

  const stopDrawing = () => {
  if (isDrawing) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      const newState = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setCanvasHistory(prev => [...prev, newState])
    }
  }
  setIsDrawing(false)
}

const handleUndo = () => {
  if (canvasHistory.length <= 1) return
  const canvas = canvasRef.current
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  
  const newHistory = canvasHistory.slice(0, -1)
  const previousState = newHistory[newHistory.length - 1]
  ctx.putImageData(previousState, 0, 0)
  setCanvasHistory(newHistory)
}

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || mode !== 'erase') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY

    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(x, y, brushSize * scaleX, 0, Math.PI * 2)
    ctx.fill()
    // Sauvegarder après chaque trait (au relâchement)
  }

  const handleAutoRemove = async () => {
    setProcessing(true)
    setError(null)

    try {
      const res = await fetch('/api/detourage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, rotation }),
      })

      const data = await res.json()

      if (data.success && data.maskUrl) {
        setProcessedUrl(data.maskUrl)
        setRawUrl(data.rawUrl || data.maskUrl)
        setMode('view')
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
      setRawUrl(null)
    }
  }

  const handleConserver = async () => {
    setProcessing(true)
    setError(null)

    try {
      // Appeler une API pour traiter sans détourage
      const res = await fetch('/api/detourage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, rotation, skipDetourage: true }),
      })

      const data = await res.json()

      if (data.success && data.maskUrl) {
       setProcessedUrl(data.maskUrl)
        setRawUrl(data.url)
      } else {
        setError(data.error || 'Erreur lors du traitement')
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau')
    } finally {
      setProcessing(false)
    }
  }

  const handleEnterEraseMode = () => {
    setMode('erase')
    setCanvasReady(false)
    setTimeout(initCanvas, 200)
  }

  const handleSaveErased = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setProcessing(true)
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png')
      })

      // Convertir en base64
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      // Upload vers Bunny
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 8)
      const path = `produits/edited_${timestamp}_${random}.png`

      const res = await fetch('/api/detourage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mode: 'erased' })
      })

      const data = await res.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Erreur upload')
      }

      setProcessedUrl(data.url)
      setRawUrl(data.url)
      setMode('view')
      setCanvasReady(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleConfirm = () => {
    if (processedUrl) {
      onConfirm(processedUrl)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {processing ? '⏳ Traitement...' : error ? '❌ Erreur' : mode === 'erase' ? '🖌️ Gomme' : processedUrl ? '✅ Résultat' : '📷 Éditer'}
          </h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-3">
          <div className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden mb-2">
            {mode === 'erase' ? (  
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
              />
            ) : (
              <img
                src={currentDisplayUrl}
                alt="Aperçu"
                className="w-full h-full object-contain"
              />
            )}
            {mode === 'erase' && !canvasReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p>Chargement...</p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {mode === 'erase' && (
            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-2 block">Taille du pinceau: {brushSize}px</label>
              <input
                type="range"
                min="10"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleUndo}
                  disabled={canvasHistory.length <= 1}
                  className="flex-1 py-2 border rounded-lg disabled:opacity-40"
                >
                  ↩ Annuler
                </button>
                <button
                  onClick={handleSaveErased}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg"
                >
                  Appliquer
                </button>
              </div>
            </div>
          )}

          {mode === 'view' && !processedUrl && !processing && (
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

          {mode === 'view' && (
            <>
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
                <div className="space-y-3">
                  <button
                    onClick={handleEnterEraseMode}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
                  >
                    <Eraser size={18} /> Effacer au doigt
                  </button>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setProcessedUrl(null); setRawUrl(null); setRotation(0) }}
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
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleAutoRemove}
                    className="flex-1 flex items-center justify-center gap-1 bg-[#22209C] text-white py-2.5 rounded-xl font-semibold hover:opacity-90 transition text-sm"
                  >
                    Détourer
                  </button>
                  <button
                    onClick={handleConserver}
                    className="flex-1 flex items-center justify-center gap-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition text-sm"
                  >
                    Conserver
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}