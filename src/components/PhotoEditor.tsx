  // components/PhotoEditor.tsx
  'use client'

  import { useState, useRef, useCallback } from 'react'
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
    const [fineRotation, setFineRotation] = useState(0)
    const [mode, setMode] = useState<'view' | 'erase' | 'restore'>('view')
    const [brushSize, setBrushSize] = useState(30)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [canvasReady, setCanvasReady] = useState(false)
    const [canvasHistory, setCanvasHistory] = useState<ImageData[]>([])
    const originalImageRef = useRef<HTMLImageElement | null>(null)

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
    if (!url) return url || ''
    if (deg === 0) return url
    const urlParts = url.split('/upload/')
    if (urlParts.length !== 2) return url
    return `${urlParts[0]}/upload/a_${deg}/${urlParts[1]}`
  }

    const totalRotation = rotation + fineRotation
    const currentDisplayUrl = getRotatedUrl(processedUrl || imageUrl, processedUrl ? 0 : totalRotation)

    const initCanvas = useCallback(() => {
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
        setCanvasHistory(() => [initialState])
        // Garder l'image originale pour la restauration
        originalImageRef.current = img
        }
      }
      img.onerror = (err) => {
        console.error('Erreur chargement image canvas:', err)
        setError('Impossible de charger l\'image pour la gomme')
      }
      img.src = urlToLoad
    }, [processedUrl, imageUrl])

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (mode !== 'erase' && mode !== 'restore') return
      setIsDrawing(true)
      draw(e)
    }

    const stopDrawing = () => {
    if (isDrawing) {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        const newState = ctx.getImageData(0, 0, canvas.width, canvas.height)
        setCanvasHistory(prev => {
          if (prev.length > 20) return [...prev.slice(-19), newState]
          return [...prev, newState]
        })
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
      if (!isDrawing || (mode !== 'erase' && mode !== 'restore')) return
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

      if (mode === 'erase') {
        ctx.fillStyle = 'white'
        ctx.beginPath()
        ctx.arc(x, y, brushSize * scaleX, 0, Math.PI * 2)
        ctx.fill()
      } else if (mode === 'restore' && originalImageRef.current) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, brushSize * scaleX, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(originalImageRef.current, 0, 0)
        ctx.restore()
      }
      // Sauvegarder après chaque trait (au relâchement)
    }

    const handleAutoRemove = async () => {
      setProcessing(true)
      setError(null)

      try {
        const res = await fetch('/api/detourage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl, rotation: rotation + fineRotation }),
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
          body: JSON.stringify({ imageUrl, rotation: rotation + fineRotation, skipDetourage: true }),
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
        const uint8Array = new Uint8Array(arrayBuffer)
        let binary = ''
        const chunkSize = 8192
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          binary += String.fromCharCode(...uint8Array.slice(i, i + chunkSize))
        }
        const base64 = btoa(binary)

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
    <div className="bg-white rounded-2xl w-[95vw] max-w-5xl shadow-2xl h-[85vh] flex relative">
      <button onClick={onCancel} className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-full z-10">
        <X size={20} />
      </button>

      <div className="flex-1 flex min-h-0 p-3 gap-4">
        {/* Image à gauche - maximum de place */}
        <div className="aspect-square h-full relative bg-white rounded-l-2xl overflow-hidden flex items-center justify-center">
          {(mode === 'erase' || mode === 'restore') ? (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain cursor-crosshair"
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
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>

        {/* Boutons à droite - compact */}
        <div className="flex-1 flex flex-col gap-2 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {processing ? '⏳ Traitement...' : error ? '❌ Erreur' : mode === 'erase' ? '🖌️ Gomme' : processedUrl ? '✅ Résultat' : '📷 Éditer'}
          </h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded-lg text-xs">
              {error}
            </div>
          )}

          {(mode === 'erase' || mode === 'restore') && (
            <>
              <button
                onClick={() => setMode('erase')}
                className={`py-2 rounded-lg text-sm font-medium ${mode === 'erase' ? 'bg-red-100 text-red-700 border-2 border-red-400' : 'border text-gray-600'}`}
              >
                🧹 Gomme
              </button>
              <button
                onClick={() => setMode('restore')}
                className={`py-2 rounded-lg text-sm font-medium ${mode === 'restore' ? 'bg-green-100 text-green-700 border-2 border-green-400' : 'border text-gray-600'}`}
              >
                🖌️ Restaurer
              </button>
              <div className="mt-2">
                <label className="text-xs text-gray-600 block mb-1">Pinceau: {brushSize}px</label>
                <input
                  type="range"
                  min="3"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <button
                onClick={handleUndo}
                disabled={canvasHistory.length <= 1}
                className="py-2 border rounded-lg text-sm disabled:opacity-40"
              >
                ↩ Annuler
              </button>
              <button
                onClick={handleSaveErased}
                className="py-2 bg-green-600 text-white rounded-lg text-sm"
              >
                Appliquer
              </button>
            </>
          )}

          {mode === 'view' && !processedUrl && !processing && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRotate('left')}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={() => handleRotate('right')}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                >
                  <RotateCw size={16} />
                </button>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Ajuster: {fineRotation}°</label>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  value={fineRotation}
                  onChange={(e) => setFineRotation(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <button
                onClick={handleAutoRemove}
                className="py-2 bg-[#22209C] text-white rounded-lg text-sm font-semibold"
              >
                Détourer
              </button>
              <button
                onClick={handleConserver}
                className="py-2 border border-gray-300 text-gray-700 rounded-lg text-sm"
              >
                Conserver
              </button>
            </>
          )}

          {mode === 'view' && processing && (
            <div className="text-center text-gray-500 text-sm py-4">
              Veuillez patienter...
            </div>
          )}

          {mode === 'view' && processedUrl && !processing && (
            <>
              <button
                onClick={handleEnterEraseMode}
                className="py-2 border border-gray-300 text-gray-700 rounded-lg text-sm"
              >
                <Eraser size={16} className="inline mr-1" /> Gomme
              </button>
              <button
                onClick={() => { setProcessedUrl(null); setRawUrl(null); setRotation(0); setFineRotation(0) }}
                className="py-2 border border-gray-300 text-gray-600 rounded-lg text-sm"
              >
                <RotateCcw size={16} className="inline mr-1" /> Recommencer
              </button>
              <button
                onClick={handleConfirm}
                className="py-2 bg-green-600 text-white rounded-lg text-sm font-semibold"
              >
                <Check size={16} className="inline mr-1" /> Valider
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  </div>
)
}
