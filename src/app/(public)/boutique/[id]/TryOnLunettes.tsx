'use client'

import { useEffect, useRef, useState } from 'react'
import { t } from '@/lib/i18n'

const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'

// Points MediaPipe FaceMesh
const R_EYE = 33   // coin externe œil droit
const L_EYE = 263  // coin externe œil gauche
const NOSE = 168   // arête du nez

type Lang = 'fr' | 'en'

/**
 * Bouton "Essayer" + modal try-on lunettes.
 * Détection visage en local (MediaPipe FaceLandmarker), aucun envoi serveur, zéro coût.
 * Le PNG des lunettes est fabriqué à la volée depuis la photo produit fond blanc
 * (le blanc devient transparent, puis autocrop).
 */
export default function TryOnLunettes({ image, nom, lang }: { image: string; nom: string; lang: Lang }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'webcam' | 'photo'>('webcam')
  const [status, setStatus] = useState('')
  const [scale, setScale] = useState(1)
  const [offsetY, setOffsetY] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const glassesRef = useRef<HTMLCanvasElement | null>(null) // PNG lunettes détouré (transparent)
  const landmarkerRef = useRef<any>(null)
  const rafRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const photoLandmarksRef = useRef<any>(null)
  const photoImgRef = useRef<HTMLImageElement | null>(null)
  // valeurs live (évite de recréer la boucle rAF à chaque réglage)
  const scaleRef = useRef(1)
  const offsetYRef = useRef(0)
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { offsetYRef.current = offsetY }, [offsetY])

  // ---- Chargement du modèle + préparation des lunettes quand on ouvre ----
  useEffect(() => {
    if (!open) return
    let cancelled = false

    ;(async () => {
      try {
        setStatus(t('Chargement…', 'Loading…', lang))
        const vision = await import('@mediapipe/tasks-vision')
        const fileset = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        )
        const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          },
          runningMode: mode === 'webcam' ? 'VIDEO' : 'IMAGE',
          numFaces: 1,
        })
        if (cancelled) { landmarker.close?.(); return }
        landmarkerRef.current = landmarker

        // Prépare le PNG transparent des lunettes (une fois)
        if (!glassesRef.current) {
          const g = await buildGlassesCutout(image)
          if (cancelled) return
          glassesRef.current = g
          if (!g) setStatus(t('Image lunettes illisible (CORS ?)', 'Glasses image unreadable (CORS?)', lang))
        }

        if (mode === 'webcam') startWebcam()
      } catch (e) {
        if (!cancelled) setStatus(t('Erreur de chargement.', 'Loading error.', lang))
      }
    })()

    return () => {
      cancelled = true
      stopWebcam()
      cancelAnimationFrame(rafRef.current)
      landmarkerRef.current?.close?.()
      landmarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  // ---- Webcam live ----
  function startWebcam() {
    const video = videoRef.current
    if (!video) return
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 720, height: 720 }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        video.srcObject = stream
        video.play()
        setStatus('')
        const loop = () => {
          renderVideoFrame()
          rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
      })
      .catch(() => setStatus(t('Accès caméra refusé.', 'Camera access denied.', lang)))
  }

  function stopWebcam() {
    streamRef.current?.getTracks().forEach((tk) => tk.stop())
    streamRef.current = null
  }

  function renderVideoFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    const lm = landmarkerRef.current
    if (!video || !canvas || !lm || video.readyState < 2) return
    const W = video.videoWidth, H = video.videoHeight
    if (!W || !H) return
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    // miroir (effet selfie naturel)
    ctx.save()
    ctx.translate(W, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, W, H)
    let res: any
    try { res = lm.detectForVideo(video, performance.now()) } catch { ctx.restore(); return }
    if (res?.faceLandmarks?.length) drawGlasses(ctx, res.faceLandmarks[0], W, H)
    ctx.restore()
  }

  // ---- Photo uploadée (statique) ----
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !landmarkerRef.current) return
    setStatus(t('Détection…', 'Detecting…', lang))
    const img = await loadImage(URL.createObjectURL(file))
    photoImgRef.current = img
    const res = landmarkerRef.current.detect(img)
    if (!res?.faceLandmarks?.length) { setStatus(t('❌ Aucun visage détecté.', '❌ No face detected.', lang)); return }
    photoLandmarksRef.current = res.faceLandmarks[0]
    setStatus('')
    drawPhoto()
  }

  function drawPhoto() {
    const canvas = canvasRef.current
    const img = photoImgRef.current
    const lm = photoLandmarksRef.current
    if (!canvas || !img) return
    const W = img.naturalWidth, H = img.naturalHeight
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0)
    if (lm) drawGlasses(ctx, lm, W, H)
  }

  // redessine la photo statique quand on bouge les curseurs
  useEffect(() => { if (open && mode === 'photo') drawPhoto() /* eslint-disable-next-line */ }, [scale, offsetY])

  function drawGlasses(ctx: CanvasRenderingContext2D, lm: any[], W: number, H: number) {
    const g = glassesRef.current
    if (!g) return
    const rx = lm[R_EYE].x * W, ry = lm[R_EYE].y * H
    const lx = lm[L_EYE].x * W, ly = lm[L_EYE].y * H
    const eyeDist = Math.hypot(lx - rx, ly - ry)
    const angle = Math.atan2(ly - ry, lx - rx)
    const gW = eyeDist * 2.15 * scaleRef.current
    const gH = gW * (g.height / g.width)
    const cx = lm[NOSE].x * W, cy = lm[NOSE].y * H + offsetYRef.current
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.drawImage(g, -gW / 2, -gH / 2, gW, gH)
    ctx.restore()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-4 uppercase transition hover:bg-black hover:text-white border border-black"
        style={{ backgroundColor: '#fff', color: '#000', fontSize: '13px', letterSpacing: '0.15em', fontWeight: 400 }}
      >
        {t('🕶️ ESSAYER', '🕶️ TRY ON', lang)}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" style={{ fontFamily: fontHelvetica }}>
          <div className="bg-white w-full max-w-lg border border-black max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-black sticky top-0 bg-white">
              <span className="uppercase" style={{ fontSize: '13px', letterSpacing: '0.15em' }}>{t('Essayer', 'Try on', lang)}</span>
              <button onClick={() => setOpen(false)} className="text-2xl leading-none hover:opacity-50">×</button>
            </div>

            <div className="p-4">
              {/* Choix mode */}
              <div className="flex gap-2 mb-3">
                {(['webcam', 'photo'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="flex-1 py-2 uppercase border border-black transition"
                    style={{
                      fontSize: '11px', letterSpacing: '0.1em',
                      backgroundColor: mode === m ? '#000' : '#fff', color: mode === m ? '#fff' : '#000',
                    }}
                  >
                    {m === 'webcam' ? t('Caméra', 'Camera', lang) : t('Une photo', 'A photo', lang)}
                  </button>
                ))}
              </div>

              <div className="relative bg-black" style={{ aspectRatio: '1 / 1', overflow: 'hidden' }}>
                <video ref={videoRef} className="hidden" playsInline muted />
                <canvas ref={canvasRef} className="w-full h-full object-contain" />
                {status && (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-center px-4" style={{ fontSize: '12px' }}>
                    {status}
                  </div>
                )}
              </div>

              {mode === 'photo' && (
                <div className="mt-3">
                  <input type="file" accept="image/*" capture="user" onChange={onUpload} style={{ fontSize: '12px' }} />
                </div>
              )}

              {/* Réglages */}
              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-2" style={{ fontSize: '11px' }}>
                  {t('Largeur', 'Width', lang)}
                  <input type="range" min={0.6} max={1.8} step={0.01} value={scale} onChange={(e) => setScale(+e.target.value)} className="flex-1" />
                </label>
                <label className="flex items-center gap-2" style={{ fontSize: '11px' }}>
                  {t('Hauteur', 'Height', lang)}
                  <input type="range" min={-60} max={60} step={1} value={offsetY} onChange={(e) => setOffsetY(+e.target.value)} className="flex-1" />
                </label>
              </div>

              <p className="mt-4" style={{ fontSize: '10px', color: '#999', lineHeight: 1.5 }}>
                {t(
                  'Aperçu indicatif. Détection réalisée sur votre appareil, aucune image envoyée.',
                  'Indicative preview. Detection runs on your device, no image is sent.',
                  lang
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- Helpers ----------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

/**
 * Charge la photo produit (fond blanc), rend le blanc transparent et autocrop
 * sur les lunettes. Renvoie un canvas (ou null si CORS/erreur).
 */
async function buildGlassesCutout(url: string): Promise<HTMLCanvasElement | null> {
  try {
    const img = await loadImage(url)
    const w = img.naturalWidth, h = img.naturalHeight
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    let data: ImageData
    try { data = ctx.getImageData(0, 0, w, h) } catch { return null } // canvas taint = CORS bloqué
    const px = data.data
    const TH = 238 // seuil blanc
    let minX = w, minY = h, maxX = 0, maxY = 0, kept = false
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (px[i] >= TH && px[i + 1] >= TH && px[i + 2] >= TH) {
          px[i + 3] = 0 // blanc -> transparent
        } else if (px[i + 3] > 0) {
          kept = true
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
      }
    }
    if (!kept) return null
    ctx.putImageData(data, 0, 0)
    // autocrop
    const cw = maxX - minX + 1, ch = maxY - minY + 1
    const out = document.createElement('canvas')
    out.width = cw; out.height = ch
    out.getContext('2d')!.drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch)
    return out
  } catch {
    return null
  }
}
