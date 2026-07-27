// src/lib/compressVideo.ts
// Compression vidéo 100% navigateur (aucune dépendance, aucun coût cloud).
// Rejoue la vidéo dans un <canvas> downscalé et la ré-encode via MediaRecorder.
// Sortie MP4/H.264 (avc1) → lisible partout, y compris iOS Safari.
// Le son est volontairement supprimé (les vidéos du site jouent en muted).

const MP4_MIMES = ['video/mp4;codecs=avc1', 'video/mp4']

/** true si le navigateur sait produire un MP4 lisible partout. */
export function canCompressToMp4(): boolean {
  const MR = (typeof window !== 'undefined' && (window as any).MediaRecorder) || null
  return !!MR && MP4_MIMES.some((m) => MR.isTypeSupported?.(m))
}

type Opts = { maxDim?: number; bitrate?: number }

async function encodeOnce(file: File, { maxDim = 720, bitrate = 2_000_000 }: Opts): Promise<Blob> {
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

    let w = video.videoWidth || maxDim
    let h = video.videoHeight || maxDim
    const scale = Math.min(1, maxDim / Math.max(w, h))
    w = Math.round(w * scale)
    h = Math.round(h * scale)
    w -= w % 2 // dimensions paires requises par H.264
    h -= h % 2

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
 * Ré-encode `file` en MP4 SANS SON, en visant la meilleure qualité possible
 * sous `targetBytes`. Le bitrate est calculé à partir de la durée pour utiliser
 * tout le budget de taille disponible (au lieu d'un bitrate fixe trop bas).
 * Ne réduit la résolution que si le bitrate calculé reste insuffisant.
 * Appelé sur TOUTES les vidéos (le son est toujours supprimé).
 * Renvoie un Blob MP4, ou null si le navigateur ne sait pas produire de MP4.
 */
export async function compressVideoToMp4(
  file: File,
  targetBytes: number,
  onProgress?: (msg: string) => void,
): Promise<Blob | null> {
  if (!canCompressToMp4()) return null

  const duration = await getDuration(file)
  // Bitrate budget : 88 % de la cible réparti sur la durée (marge conteneur/keyframes).
  const budget =
    duration > 0
      ? Math.min(12_000_000, Math.max(800_000, Math.floor((targetBytes * 8 * 0.88) / duration)))
      : 3_000_000

  // On garde la résolution d'origine (cap 1080p) tant que possible ; on ne
  // downscale qu'en dernier recours si le fichier dépasse encore la cible.
  const attempts: Opts[] = [
    { maxDim: 1080, bitrate: budget },
    { maxDim: 1080, bitrate: Math.floor(budget * 0.75) },
    { maxDim: 720, bitrate: Math.floor(budget * 0.6) },
    { maxDim: 540, bitrate: Math.floor(budget * 0.5) },
  ]

  let best: Blob | null = null
  for (let i = 0; i < attempts.length; i++) {
    onProgress?.(i === 0 ? 'Traitement de la vidéo…' : `Compression en cours… (essai ${i + 1})`)
    const blob = await encodeOnce(file, attempts[i])
    if (!best || blob.size < best.size) best = blob
    if (blob.size <= targetBytes) return blob
  }
  return best // meilleur effort même si encore un peu au-dessus
}
