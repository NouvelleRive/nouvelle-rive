// src/lib/compressVideo.ts
// Compression vidéo 100% navigateur (aucun coût cloud), son toujours supprimé.
// 2 moteurs :
//  1) WebCodecs (VideoEncoder) → respecte réellement le bitrate → vrai 1080p net.
//  2) Repli MediaRecorder (canvas.captureStream) si WebCodecs indisponible.
// Sortie MP4/H.264 (avc1) → lisible partout, y compris iOS Safari.

const MP4_MIMES = ['video/mp4;codecs=avc1', 'video/mp4']

function hasWebCodecs(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).VideoEncoder !== 'undefined' &&
    typeof (window as any).VideoFrame !== 'undefined' &&
    typeof (HTMLVideoElement.prototype as any).requestVideoFrameCallback === 'function'
  )
}

function hasMediaRecorderMp4(): boolean {
  const MR = (typeof window !== 'undefined' && (window as any).MediaRecorder) || null
  return !!MR && MP4_MIMES.some((m) => MR.isTypeSupported?.(m))
}

/** true si le navigateur sait produire un MP4 lisible partout. */
export function canCompressToMp4(): boolean {
  return hasWebCodecs() || hasMediaRecorderMp4()
}

type Opts = { maxDim?: number; bitrate?: number }

/** Dimensions paires (requis H.264), downscalées pour tenir dans maxDim. */
function fitDims(vw: number, vh: number, maxDim: number) {
  const scale = Math.min(1, maxDim / Math.max(vw, vh))
  let w = Math.round(vw * scale)
  let h = Math.round(vh * scale)
  w -= w % 2
  h -= h % 2
  return { w: Math.max(2, w), h: Math.max(2, h) }
}

// ─────────────────────────────────────────────────────────────────────────
// Moteur 1 : WebCodecs (bitrate réellement respecté)
// ─────────────────────────────────────────────────────────────────────────

async function pickAvcCodec(w: number, h: number, bitrate: number, fps: number): Promise<string | null> {
  const VE = (window as any).VideoEncoder
  // High → Main → Baseline, niveau 4.2 (couvre 1080p large marge)
  for (const codec of ['avc1.64002A', 'avc1.640028', 'avc1.4D002A', 'avc1.42E02A']) {
    try {
      const { supported } = await VE.isConfigSupported({ codec, width: w, height: h, bitrate, framerate: fps })
      if (supported) return codec
    } catch {
      /* essaie le suivant */
    }
  }
  return null
}

async function encodeWebCodecs(file: File, { maxDim = 1080, bitrate = 3_000_000 }: Opts): Promise<Blob> {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  ;(video as any).playsInline = true

  try {
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res()
      video.onerror = () => rej(new Error('Lecture vidéo impossible'))
    })

    const fps = 30
    const { w, h } = fitDims(video.videoWidth || maxDim, video.videoHeight || maxDim, maxDim)

    const codec = await pickAvcCodec(w, h, bitrate, fps)
    if (!codec) throw new Error('Aucun profil H.264 supporté par WebCodecs')

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: w, height: h },
      fastStart: 'in-memory', // moov au début → lecture progressive immédiate
    })

    let encErr: any = null
    const encoder = new (window as any).VideoEncoder({
      output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
      error: (e: any) => {
        encErr = e
      },
    })
    encoder.configure({ codec, width: w, height: h, bitrate, framerate: fps })

    await video.play()

    let frameCount = 0
    let lastTs = -1
    await new Promise<void>((resolve) => {
      const onFrame = (_now: number, meta: any) => {
        if (encErr) return resolve()
        ctx.drawImage(video, 0, 0, w, h)
        let ts = Math.round((meta?.mediaTime ?? video.currentTime) * 1_000_000)
        if (ts <= lastTs) ts = lastTs + 1
        lastTs = ts
        const frame = new (window as any).VideoFrame(canvas, { timestamp: ts })
        encoder.encode(frame, { keyFrame: frameCount % 60 === 0 })
        frame.close()
        frameCount++
        if (!video.ended) (video as any).requestVideoFrameCallback(onFrame)
        else resolve()
      }
      ;(video as any).requestVideoFrameCallback(onFrame)
      video.onended = () => resolve()
    })

    await encoder.flush()
    encoder.close()
    if (encErr) throw encErr
    muxer.finalize()
    const { buffer } = (muxer.target as any)
    return new Blob([buffer], { type: 'video/mp4' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Moteur 2 : MediaRecorder (repli — bitrate approximatif)
// ─────────────────────────────────────────────────────────────────────────

async function encodeMediaRecorder(file: File, { maxDim = 720, bitrate = 2_000_000 }: Opts): Promise<Blob> {
  const mime = MP4_MIMES.find((m) => (window as any).MediaRecorder.isTypeSupported(m))!
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  ;(video as any).playsInline = true

  try {
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res()
      video.onerror = () => rej(new Error('Lecture vidéo impossible'))
    })

    const { w, h } = fitDims(video.videoWidth || maxDim, video.videoHeight || maxDim, maxDim)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const stream = canvas.captureStream(30)
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate })
    const chunks: BlobPart[] = []
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data)
    }
    const stopped = new Promise<Blob>((res) => {
      rec.onstop = () => res(new Blob(chunks, { type: 'video/mp4' }))
    })

    rec.start()
    await video.play()

    let raf = 0
    const draw = () => {
      ctx.drawImage(video, 0, 0, w, h)
      raf = requestAnimationFrame(draw)
    }
    draw()

    await new Promise<void>((res) => {
      video.onended = () => res()
    })
    cancelAnimationFrame(raf)
    if (rec.state !== 'inactive') rec.stop()
    return await stopped
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ─────────────────────────────────────────────────────────────────────────

/** Durée de la vidéo en secondes (0 si indéterminable). */
async function getDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.src = url
  v.muted = true
  try {
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res()
      v.onerror = () => rej(new Error('meta'))
    })
    return isFinite(v.duration) && v.duration > 0 ? v.duration : 0
  } catch {
    return 0
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Ré-encode `file` en MP4 SANS SON, à la meilleure qualité possible sous `targetBytes`.
 * Via WebCodecs quand dispo : vrai 1080p à bitrate calculé pour remplir le budget de
 * taille. Repli MediaRecorder sinon. Renvoie null si aucun encodeur MP4 dispo.
 */
export async function compressVideoToMp4(
  file: File,
  targetBytes: number,
  onProgress?: (msg: string) => void,
): Promise<Blob | null> {
  const duration = await getDuration(file)
  // Bitrate visé pour remplir ~90 % de la cible sur toute la durée.
  const budget =
    duration > 0
      ? Math.min(12_000_000, Math.max(800_000, Math.floor((targetBytes * 8 * 0.9) / duration)))
      : 3_000_000

  // ── Moteur 1 : WebCodecs (bitrate respecté → 1080p net) ──
  if (hasWebCodecs()) {
    try {
      onProgress?.('Traitement de la vidéo…')
      let blob = await encodeWebCodecs(file, { maxDim: 1080, bitrate: budget })
      // Filet de sécurité : si l'estimation dépasse la cible, réajuste le bitrate au prorata.
      if (blob.size > targetBytes) {
        onProgress?.('Compression en cours…')
        const adjusted = Math.max(600_000, Math.floor((budget * targetBytes) / blob.size * 0.9))
        blob = await encodeWebCodecs(file, { maxDim: 1080, bitrate: adjusted })
      }
      return blob
    } catch (e) {
      console.warn('WebCodecs indisponible, repli MediaRecorder :', e)
      // continue vers le repli
    }
  }

  // ── Moteur 2 : MediaRecorder (repli) ──
  if (!hasMediaRecorderMp4()) return null

  const attempts: Opts[] = [
    { maxDim: 1080, bitrate: budget },
    { maxDim: 1080, bitrate: Math.floor(budget * 0.7) },
    { maxDim: 1080, bitrate: Math.floor(budget * 0.5) },
    { maxDim: 900, bitrate: Math.floor(budget * 0.5) },
    { maxDim: 720, bitrate: Math.floor(budget * 0.45) },
  ]

  let best: Blob | null = null
  for (let i = 0; i < attempts.length; i++) {
    onProgress?.(i === 0 ? 'Traitement de la vidéo…' : `Compression en cours… (essai ${i + 1})`)
    try {
      const blob = await encodeMediaRecorder(file, attempts[i])
      if (!best || blob.size < best.size) best = blob
      if (blob.size <= targetBytes) return blob
    } catch (e) {
      console.warn(`Essai MediaRecorder ${i + 1} échoué :`, e)
    }
  }
  return best
}
