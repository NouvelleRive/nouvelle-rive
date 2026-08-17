'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { PlusSquare, LayoutGrid, Play, Copy, Pencil } from 'lucide-react'
import { storage } from '@/lib/firebaseConfig'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

type Tab = 'contenu' | 'feed'
type Reseau = 'ig' | 'tiktok'

// Les 7 chroniques de la semaine (une par jour, une par fille).
// day = getDay() : 0 = dimanche … 6 = samedi.
const CHRONIQUES = [
  {
    key: 'infinite-slider', day: 0, jour: 'Dimanche', titre: 'INFINITE SLIDER', responsable: 'Salomé', heureDefaut: '11:00', objectifDefaut: '', formatDefaut: 'reel',
    captionDefaut: "Les nouveautés de la semaine défilent 🌊\n\nLaquelle repart avec toi ? 🦋",
  },
  {
    key: 'compo-de-lo', day: 1, jour: 'Lundi', titre: 'LES COMPO DE LO', responsable: 'Loah', heureDefaut: '14:00', objectifDefaut: 'Vendre', formatDefaut: 'reel',
    captionDefaut: "Avec quoi on porte un (sublime) XX ? On en appelle à l'oeil de Lo. Ci-dessus nos plus belles compo.\nToutes ces pépites sont disponibles chez 🌊NOUVELLE RIVE, sur le site et en boutique.\n💙 Commente ta pièce préférée pour recevoir sa réf\n\nWhat do you wear a (stunning) XX with? Lo has the eye for it. Above, our favourite pairings.\nAll these gems are available at 🌊NOUVELLE RIVE, online and in store.\n💙 Comment your fav piece to get the ref\n\n🦋www.nouvellerive.eu\n🧿8 rue des Ecouffes Paris le Marais",
  },
  {
    key: 'book-olga', day: 2, jour: 'Mardi', titre: "LE BOOK D'OLGA", responsable: 'Olga', heureDefaut: '11:00', objectifDefaut: 'Vendre', ctaDefaut: 'Commentaire', formatDefaut: 'reel',
    captionDefaut: "Le book d'Olga 📖 sa sélection coup de cœur de la semaine\n💙 Commente pour obtenir le lien\n\nOlga's book 📖 her favourite picks of the week\n💙 Comment to get the link",
  },
  {
    key: 'le-rideau', day: 3, jour: 'Mercredi', titre: 'LE RIDEAU', responsable: 'Amanda', heureDefaut: '11:00', objectifDefaut: '', formatDefaut: 'reel',
    captionDefaut: "Que portent nos stars du vintage ? C'est la mission d'Amanda de le découvrir 🕵️‍♀️🔎🌊\n\nSpoiler ce sera local et de saison 🦋",
  },
  {
    key: 'microboutique-hina', day: 4, jour: 'Jeudi', titre: "LA MICROBOUTIQUE D'HINA", responsable: 'Hina', heureDefaut: '12:00', objectifDefaut: '', formatDefaut: 'reel',
    captionDefaut: "La microboutique d'Hina 🛍️ ses trouvailles à shopper avant tout le monde\n\nÇa part vite 🦋",
  },
  {
    key: 'fond-blanc', day: 4, jour: 'Jeudi', titre: 'WEEK FAV', responsable: 'Équipe', heureDefaut: '18:00', objectifDefaut: 'Vendre', ctaDefaut: 'Link in bio', formatDefaut: 'publi',
    captionDefaut: "Parmi nos favoris dans les arrivages de la semaine. Lien vers tous nos week fav en bio !\n\nA few of our favourites from this week's new arrivals. Link to all our week favs in bio!",
  },
  {
    key: 'shabbat-quote', day: 5, jour: 'Vendredi', titre: 'SHABBAT QUOTE', responsable: 'Salomé', heureDefaut: '11:00', objectifDefaut: 'Partage DM', formatDefaut: 'publi',
    captionDefaut: "Shabbat Shalom 🌊 la quote de la semaine pour bien commencer le week-end 🦋",
  },
  {
    key: 'energies-sarah', day: 6, jour: 'Samedi', titre: 'LES ENERGIES DE SARAH', responsable: 'Sarah', heureDefaut: '11:00', objectifDefaut: '', formatDefaut: 'reel',
    captionDefaut: "Les énergies de Sarah ✨ sa pièce vibe du moment\n\nElle est pour toi ? 🦋",
  },
] as const

type Chronique = (typeof CHRONIQUES)[number]

type Media = { url: string; type: 'image' | 'video' }

type Production = {
  date: string
  theme: string
  objectif: string
  format: 'reel' | 'publi'
  videoUrl: string
  vignetteUrl: string
  vignetteOptions: string[]
  vignetteOffsetY: number // position verticale du crop 4:5 (0-100, 50 = centré)
  medias: Media[]
  caption: string
  heurePost: string
  cta: string
  lieu: string
  collab: string
  status: string
  pret: boolean
}

type CollabOption = { nom: string; handle: string }

// Ajoute/retire un handle dans une liste séparée par des virgules (dédupliquée).
function toggleHandle(current: string, handle: string): string {
  const tokens = current.split(',').map((t) => t.trim().replace(/^@/, '')).filter(Boolean)
  const exists = tokens.includes(handle)
  const next = exists ? tokens.filter((t) => t !== handle) : [...tokens, handle]
  return next.map((t) => `@${t}`).join(', ')
}

function hasHandle(current: string, handle: string): boolean {
  return current.split(',').map((t) => t.trim().replace(/^@/, '')).includes(handle)
}

function frDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Une production est complète si tous les champs utiles sont remplis
// (le lieu a un défaut, le collab est optionnel donc non requis).
function isComplete(p: Production): boolean {
  const base = [p.theme, p.objectif, p.caption, p.heurePost, p.cta, p.lieu].every((v) => !!(v && v.trim()))
  const media = p.format === 'publi' ? (p.medias?.length || 0) > 0 : !!(p.videoUrl && p.vignetteUrl)
  return base && media
}

// Aperçu (tuile/feed) : vignette, sinon 1er média, sinon 1re image vidéo.
function previewUrl(p: { vignetteUrl?: string; videoUrl?: string; medias?: Media[] }): { url: string; isVideo: boolean } | null {
  if (p.vignetteUrl) return { url: p.vignetteUrl, isVideo: false }
  const m = p.medias?.[0]
  if (m) return { url: m.url, isVideo: m.type === 'video' }
  if (p.videoUrl) return { url: p.videoUrl, isVideo: true }
  return null
}

// Upload direct vers Firebase Storage (pas de limite de taille Vercel, gratuit,
// aucune clé exposée). L'URL de download est publique → utilisable par l'API IG.
async function uploadMedia(file: File, kind: 'video' | 'vignette'): Promise<string> {
  const ext = (file.name.split('.').pop() || (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase()
  const path = `reseaux/${kind}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const fileRef = storageRef(storage, path)
  await uploadBytes(fileRef, file, { contentType: file.type || undefined })
  return await getDownloadURL(fileRef)
}

// Capture l'image courante d'une <video> → File JPEG (vignette gratuite, côté client).
function captureFrame(video: HTMLVideoElement): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return reject(new Error('canvas indisponible'))
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('capture échouée'))
      resolve(new File([blob], `vignette_${Date.now()}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  })
}

// Capture des frames SANS toucher l'aperçu : vidéo hors-écran en crossOrigin
// (canvas non « tainted »). Cache-buster pour éviter une copie déjà en cache
// sans en-têtes CORS (sinon « operation is insecure »). L'aperçu, lui, reste
// sans crossOrigin pour éviter le rectangle noir quand le CDN n'envoie pas CORS.
function captureFramesFromUrl(url: string, times: number[]): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.muted = true; v.playsInline = true; v.preload = 'auto'
    v.src = url + (url.includes('?') ? '&' : '?') + 'cors=' + Date.now()
    const out: File[] = []
    let i = 0
    const seekNext = () => {
      if (i >= times.length) return resolve(out)
      try { v.currentTime = Math.max(0, Math.min(times[i], (v.duration || 0.1) - 0.05)) } catch (e) { reject(e as Error) }
    }
    v.onloadeddata = () => seekNext()
    v.onerror = () => reject(new Error('vidéo illisible (CORS ?)'))
    v.onseeked = () => {
      captureFrame(v).then((f) => { out.push(f); i++; seekNext() }).catch(reject)
    }
  })
}

// Bande centrée 4:5 (format grille IG) : montre ce qui reste visible dans la
// grille — le haut/bas hors des pointillés est coupé.
function CropGuide() {
  return (
    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 w-full aspect-[4/5] max-h-full border-y-2 border-dashed border-white/80 pointer-events-none" />
  )
}

function ProductionCard({ chronique, prod, onSaved, collabOptions, dates = [], onSwapped }: { chronique: Chronique; prod: Production; onSaved: (p: Production) => void; collabOptions: CollabOption[]; dates?: string[]; onSwapped?: () => void }) {
  const [p, setP] = useState<Production>(prod)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [collabInput, setCollabInput] = useState('')
  const [posting, setPosting] = useState(false)
  const [tiktokPosting, setTiktokPosting] = useState(false)
  const [zoom, setZoom] = useState<Media | null>(null) // aperçu plein écran

  useEffect(() => setP(prod), [prod])
  const set = (k: keyof Production, v: any) => setP((x) => ({ ...x, [k]: v }))
  const collabHandles = p.collab.split(',').map((t) => t.trim().replace(/^@/, '')).filter(Boolean)

  // Mode « Publi » : plusieurs images/vidéos (carrousel).
  const addMedias = async (files: FileList) => {
    setBusy('medias')
    try {
      const added: Media[] = []
      for (const f of Array.from(files)) {
        const kind = f.type.startsWith('video') ? 'video' : 'image'
        const url = await uploadMedia(f, kind === 'video' ? 'video' : 'vignette')
        added.push({ url, type: kind })
      }
      setP((x) => ({ ...x, medias: [...(x.medias || []), ...added].slice(0, 10) }))
    } catch (e: any) { alert(e?.message) }
    finally { setBusy(null) }
  }
  const removeMedia = (i: number) => setP((x) => ({ ...x, medias: x.medias.filter((_, j) => j !== i) }))

  // Importe les photos fond blanc des pièces « week fav » de la semaine.
  const importWeekFav = async () => {
    setBusy('medias')
    try {
      const d = await fetch('/api/reseaux/weekfav-photos', { cache: 'no-store' }).then((r) => r.json())
      if (!d.success) throw new Error(d.error)
      const imgs: Media[] = (d.items || []).map((it: any) => ({ url: it.photo, type: 'image' as const })).filter((m: Media) => m.url)
      if (!imgs.length) { alert('Aucune pièce en week fav (14 derniers jours)'); return }
      // Co-poste automatiquement les chineuses des pièces importées.
      const chineuses: string[] = d.chineuses || []
      setP((x) => {
        const existing = x.collab.split(',').map((t) => t.trim().replace(/^@/, '')).filter(Boolean)
        const merged = [...new Set([...existing, ...chineuses])]
        return { ...x, medias: [...(x.medias || []), ...imgs].slice(0, 10), collab: merged.join(', ') }
      })
    } catch (e: any) { alert(e?.message || 'Erreur import week fav') }
    finally { setBusy(null) }
  }
  const hasMedia = p.format === 'publi' ? (p.medias?.length || 0) > 0 : !!p.videoUrl

  const save = async () => {
    setSaving(true)
    try {
      // Reel sans vignette → on capture la 1ʳᵉ image et on l'enregistre comme
      // vignette (pour que le feed l'affiche partout, iOS inclus).
      let toSave = p
      if (p.format === 'reel' && p.videoUrl && !p.vignetteUrl && videoEl) {
        try {
          const frame = await captureFrame(videoEl)
          const url = await uploadMedia(frame, 'vignette')
          toSave = { ...p, vignetteUrl: url }
          setP(toSave)
        } catch { /* pas bloquant */ }
      }
      const res = await fetch('/api/reseaux/contenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chronique: chronique.key, ...toSave }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const updated = { ...toSave, pret: hasMedia }
      onSaved(updated)
    } catch (e: any) {
      alert(e?.message || 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const onVideo = async (file: File) => {
    setBusy('video')
    try { set('videoUrl', await uploadMedia(file, 'video')) }
    catch (e: any) { alert(e?.message) }
    finally { setBusy(null) }
  }

  const addVignette = (url: string) =>
    setP((x) => {
      // Garde l'ancienne vignette sélectionnée comme option (sinon l'import l'écrase).
      const prev = x.vignetteUrl && x.vignetteUrl !== url ? [x.vignetteUrl] : []
      return { ...x, vignetteOptions: [...new Set([...(x.vignetteOptions || []), ...prev, url])], vignetteUrl: url }
    })
  const removeVignetteOption = (url: string) =>
    setP((x) => {
      const opts = (x.vignetteOptions || []).filter((u) => u !== url)
      return { ...x, vignetteOptions: opts, vignetteUrl: x.vignetteUrl === url ? (opts[0] || '') : x.vignetteUrl }
    })

  const onVignetteFile = async (file: File) => {
    setBusy('vignette')
    try { addVignette(await uploadMedia(file, 'vignette')) }
    catch (e: any) { alert(e?.message) }
    finally { setBusy(null) }
  }

  // Propose plusieurs vignettes en capturant des images à différents instants
  // de la vidéo d'aperçu (crossOrigin=anonymous → canvas non "tainted").
  const genVignetteOptions = async () => {
    if (!videoEl) { alert('Attends que la vidéo soit chargée'); return }
    setBusy('vignette')
    try {
      const d = videoEl.duration || 0
      const times = d > 1 ? [d * 0.1, d * 0.35, d * 0.6, d * 0.85] : [0.1]
      const frames = await captureFramesFromUrl(p.videoUrl, times)
      const urls: string[] = []
      for (const frame of frames) urls.push(await uploadMedia(frame, 'vignette'))
      setP((x) => {
        const prev = x.vignetteUrl ? [x.vignetteUrl] : []
        return {
          ...x,
          vignetteOptions: [...new Set([...(x.vignetteOptions || []), ...prev, ...urls])],
          vignetteUrl: x.vignetteUrl || urls[0],
        }
      })
      try { videoEl.currentTime = 0 } catch {}
    } catch (e: any) { alert(e?.message || 'Erreur') }
    finally { setBusy(null) }
  }

  // Drag vertical pour choisir la zone visible (objectPosition Y) du crop 4:5.
  const dragRef = useRef<{ startY: number; startOffset: number; h: number } | null>(null)
  const onCropDown = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startOffset: p.vignetteOffsetY ?? 50, h: e.currentTarget.clientHeight || 1 }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onCropMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { startY, startOffset, h } = dragRef.current
    const deltaPct = ((e.clientY - startY) / h) * 100
    const ny = Math.max(0, Math.min(100, startOffset - deltaPct))
    set('vignetteOffsetY', ny)
  }
  const onCropUp = () => { dragRef.current = null }

  // Publie immédiatement cette prod sur IG (réutilise le posteur partagé).
  const postNow = async () => {
    if (!hasMedia) return
    if (!confirm('Poster ce contenu sur Instagram maintenant ?')) return
    setPosting(true)
    try {
      const res = await fetch('/api/reseaux/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chronique: chronique.key, date: p.date }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'échec')
      onSaved({ ...p, status: 'published', videoUrl: '', medias: [], pret: true })
    } catch (e: any) {
      alert(e?.message || 'Erreur publication')
    } finally {
      setPosting(false)
    }
  }

  // Dépose en brouillon sur TikTok (vidéo → reel, images → carrousel photo).
  const postTikTok = async () => {
    const video = p.videoUrl || p.medias?.find((m) => m.type === 'video')?.url || ''
    const images = (p.medias || []).filter((m) => m.type === 'image').map((m) => m.url)
    const body: any = (p.format === 'publi' && images.length)
      ? { imageUrls: images, caption: p.caption }
      : video ? { videoUrl: video } : null
    if (!body) { alert('Rien à envoyer sur TikTok') ; return }
    if (!confirm('Envoyer en brouillon sur TikTok ?')) return
    // Copie la caption pour la coller dans l'éditeur TikTok (le brouillon ne la
    // préremplit pas via l'API ; auto après audit Direct Post).
    try { await navigator.clipboard?.writeText(p.caption || '') } catch {}
    setTiktokPosting(true)
    try {
      const res = await fetch('/api/tiktok/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'échec')
      alert('Envoyé sur TikTok ✅ — caption copiée. J\'ouvre TikTok : va dans tes notifs, colle la caption et publie.')
      // Ouvre l'app TikTok (deep link). Si pas installée, ne fait rien (on reste sur la page).
      window.location.href = 'tiktok://'
    } catch (e: any) {
      alert(e?.message || 'Erreur TikTok')
    } finally {
      setTiktokPosting(false)
    }
  }

  const grabFrame = async () => {
    if (!videoEl) return
    setBusy('vignette')
    try {
      const [frame] = await captureFramesFromUrl(p.videoUrl, [videoEl.currentTime || 0.1])
      addVignette(await uploadMedia(frame, 'vignette'))
    } catch (e: any) { alert(e?.message) }
    finally { setBusy(null) }
  }

  const input = 'w-full font-sans border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#22209C]'
  const label = 'block text-sm font-medium text-gray-600 mb-1'

  return (
    <div className="reseaux-form pt-4 first:pt-0 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 capitalize">{frDate(p.date)}</span>
        <span className={`text-sm font-medium rounded-full px-3 py-1 ${hasMedia ? 'text-green-700 bg-green-50' : 'text-amber-600 bg-amber-50'}`}>
          {hasMedia ? 'Prêt' : 'À faire'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600 w-20 shrink-0">Thème</label>
        <input className={`${input} flex-1`} value={p.theme} onChange={(e) => set('theme', e.target.value)} placeholder="Thème du jour" />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600 w-20 shrink-0">Objectif</label>
        <input className={`${input} flex-1`} value={p.objectif} onChange={(e) => set('objectif', e.target.value)} placeholder="Ce qu'on veut obtenir" />
      </div>

      {/* Toggle Reel / Publi (carrousel) */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600 w-20 shrink-0">Format</label>
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5 text-sm">
          <button type="button" onClick={() => set('format', 'reel')} className={`px-4 py-1 rounded-md ${p.format === 'reel' ? 'bg-white text-[#22209C] shadow-sm font-medium' : 'text-gray-500'}`}>Reel</button>
          <button type="button" onClick={() => set('format', 'publi')} className={`px-4 py-1 rounded-md ${p.format === 'publi' ? 'bg-white text-[#22209C] shadow-sm font-medium' : 'text-gray-500'}`}>Publi</button>
        </div>
      </div>

      {p.format === 'reel' ? (
      /* Vidéo + vignette (en grand, avec pointillés de zone visible dans la grille 4:5) */
      <div className="space-y-3">
        {/* Vidéo */}
        <div>
          <div className={label}>Vidéo (postée avec le son)</div>
          {p.videoUrl ? (
            <div className="relative inline-block">
              <video ref={setVideoEl} src={p.videoUrl} controls className="max-h-72 max-w-full rounded-lg" />
              <CropGuide />
              <button onClick={() => set('videoUrl', '')} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-sm leading-none flex items-center justify-center z-10" title="Supprimer la vidéo">×</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1 py-10 border border-dashed border-gray-300 rounded-lg cursor-pointer text-gray-300 hover:border-[#22209C] hover:text-[#22209C]">
              {busy === 'video' ? <span className="text-sm text-gray-400">Envoi…</span> : <span className="text-5xl leading-none">+</span>}
              <span className="text-sm text-gray-400">Vidéo</span>
              <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && onVideo(e.target.files[0])} />
            </label>
          )}
        </div>

        {/* Vignette : fenêtre 4:5 (ce qui s'affiche dans la grille) ; glisse pour cadrer */}
        <div>
          <div className={label}>Vignette (glisse l'image pour cadrer)</div>
          {(p.vignetteUrl || p.videoUrl) ? (
            <div
              className="relative w-40 aspect-[4/5] rounded-lg overflow-hidden bg-gray-100 mx-auto touch-none select-none cursor-ns-resize"
              onPointerDown={onCropDown} onPointerMove={onCropMove} onPointerUp={onCropUp} onPointerCancel={onCropUp}
            >
              {p.vignetteUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.vignetteUrl} alt="" className="w-full h-full object-cover pointer-events-none" style={{ objectPosition: `50% ${p.vignetteOffsetY ?? 50}%` }} />
              ) : (
                <video src={`${p.videoUrl}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover pointer-events-none" style={{ objectPosition: `50% ${p.vignetteOffsetY ?? 50}%` }} />
              )}
              {!p.vignetteUrl && <span className="absolute bottom-1 left-1 rounded bg-black/60 text-white text-[11px] px-1.5 py-0.5">auto</span>}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1 py-10 border border-dashed border-gray-300 rounded-lg cursor-pointer text-gray-300 hover:border-[#22209C] hover:text-[#22209C]">
              {busy === 'vignette' ? <span className="text-sm text-gray-400">Envoi…</span> : <span className="text-5xl leading-none">+</span>}
              <span className="text-sm text-gray-400">Vignette</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onVignetteFile(e.target.files[0])} />
            </label>
          )}

          {/* Options de vignettes : clique pour choisir */}
          {(p.vignetteOptions?.length || 0) > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {p.vignetteOptions.map((url) => (
                <div
                  key={url}
                  onClick={() => set('vignetteUrl', url)}
                  className={`relative w-14 aspect-[4/5] rounded overflow-hidden cursor-pointer ${p.vignetteUrl === url ? 'ring-2 ring-[#22209C]' : 'ring-1 ring-gray-200'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" style={{ objectPosition: `50% ${p.vignetteOffsetY ?? 50}%` }} />
                  <button onClick={(e) => { e.stopPropagation(); removeVignetteOption(url) }} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] leading-none flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          )}

          {p.videoUrl && (
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              <button onClick={genVignetteOptions} disabled={busy === 'vignette'} className="text-sm font-medium text-[#22209C] border border-[#22209C] rounded-lg px-3 py-1.5">
                {busy === 'vignette' ? '…' : 'Proposer des vignettes'}
              </button>
              <button onClick={grabFrame} disabled={busy === 'vignette'} className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5">
                Image actuelle
              </button>
              <label className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 cursor-pointer">
                Importer
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onVignetteFile(e.target.files[0])} />
              </label>
            </div>
          )}
          <p className="text-sm text-gray-400 mt-1">Glisse l'image de haut en bas pour choisir la zone visible dans la grille.</p>
        </div>
      </div>
      ) : (
      /* Mode Publi : carrousel de plusieurs images / vidéos */
      <div>
        <div className={label}>Contenu (images / vidéos)</div>
        <div className="flex flex-wrap gap-2">
          {p.medias?.map((m, i) => (
            <div key={i} className="relative w-24 h-28 rounded-lg overflow-hidden bg-gray-100">
              {m.type === 'video'
                ? <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" onClick={() => setZoom(m)} className="w-full h-full object-cover cursor-zoom-in" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={m.url} alt="" onClick={() => setZoom(m)} className="w-full h-full object-cover cursor-zoom-in" />}
              {m.type === 'video' && <Play size={13} className="absolute bottom-1 left-1 text-white drop-shadow pointer-events-none" fill="white" />}
              <button onClick={() => removeMedia(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-sm leading-none flex items-center justify-center">×</button>
            </div>
          ))}
          {(p.medias?.length || 0) < 10 && (
            <label className="w-24 h-28 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-300 cursor-pointer hover:border-[#22209C] hover:text-[#22209C]">
              {busy === 'medias' ? <span className="text-sm text-gray-400">Envoi…</span> : <span className="text-3xl leading-none">+</span>}
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => e.target.files?.length && addMedias(e.target.files)} />
            </label>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={importWeekFav} disabled={busy === 'medias'} className="text-sm font-medium text-[#22209C] border border-[#22209C] rounded-lg px-3 py-1.5">
            {busy === 'medias' ? '…' : 'Importer depuis Week fav'}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-1">Jusqu'à 10 médias, dans l'ordre du carrousel.</p>
      </div>
      )}

      <div>
        <label className={label}>Caption</label>
        <textarea
          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }}
          className={`${input} resize-none overflow-hidden`}
          value={p.caption}
          onChange={(e) => { set('caption', e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px` }}
          placeholder="Légende du post"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600 w-24 shrink-0">Heure de post</label>
        <input type="time" className="font-sans border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-[#22209C]" value={p.heurePost} onChange={(e) => set('heurePost', e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600 w-24 shrink-0">CTA</label>
        <input className={`${input} flex-1`} value={p.cta} onChange={(e) => set('cta', e.target.value)} placeholder="Appel à l'action" />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600 w-24 shrink-0">Lieu</label>
        <input className={`${input} flex-1`} value={p.lieu} onChange={(e) => set('lieu', e.target.value)} />
      </div>
      <div>
        <label className={label}>Inviter à collaborer</label>
        {collabOptions.length > 0 && (
          <select
            className={`${input} mb-2`}
            value=""
            onChange={(e) => { if (e.target.value) set('collab', toggleHandle(p.collab, e.target.value)) }}
          >
            <option value="">Ajouter une chineuse…</option>
            {collabOptions.map((o) => (
              <option key={o.handle} value={o.handle}>
                {hasHandle(p.collab, o.handle) ? '✓ ' : ''}@{o.handle}
              </option>
            ))}
          </select>
        )}
        {/* Puces des comptes sélectionnés, avec × pour retirer */}
        {collabHandles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {collabHandles.map((h) => (
              <span key={h} className="inline-flex items-center gap-1 bg-[#22209C]/10 text-[#22209C] text-sm rounded-full pl-2.5 pr-1 py-1">
                @{h}
                <button onClick={() => set('collab', toggleHandle(p.collab, h))} className="w-4 h-4 rounded-full bg-[#22209C]/20 flex items-center justify-center leading-none" title="Retirer">×</button>
              </span>
            ))}
          </div>
        )}
        <input
          className={input}
          value={collabInput}
          onChange={(e) => setCollabInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && collabInput.trim()) {
              e.preventDefault()
              set('collab', toggleHandle(p.collab, collabInput.trim()))
              setCollabInput('')
            }
          }}
          onBlur={() => { if (collabInput.trim()) { set('collab', toggleHandle(p.collab, collabInput.trim())); setCollabInput('') } }}
          placeholder="ou tape un @compte puis Entrée"
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-[#22209C] text-white text-sm font-medium rounded-lg py-2.5 disabled:opacity-50"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>

      {hasMedia && p.status !== 'published' && (
        <button
          onClick={postNow}
          disabled={posting}
          className="w-full border border-[#22209C] text-[#22209C] text-sm font-medium rounded-lg py-2.5 disabled:opacity-50"
        >
          {posting ? 'Publication en cours…' : 'Poster maintenant sur Instagram'}
        </button>
      )}

      {hasMedia && p.status !== 'published' && (
        <button
          onClick={postTikTok}
          disabled={tiktokPosting}
          className="w-full border border-gray-800 text-gray-800 text-sm font-medium rounded-lg py-2.5 disabled:opacity-50"
        >
          {tiktokPosting ? 'Envoi TikTok…' : 'Poster maintenant sur TikTok (brouillon)'}
        </button>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
        >
          {zoom.type === 'video'
            ? <video src={zoom.url} controls autoPlay playsInline className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={zoom.url} alt="" className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />}
          <button
            onClick={() => setZoom(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white text-2xl leading-none flex items-center justify-center"
          >×</button>
        </div>
      )}
    </div>
  )
}

function StructureModal({ chronique, onClose }: { chronique: Chronique; onClose: () => void }) {
  const [s, setS] = useState({ accroche: '', plan1: '', plan2: '', plan3: '', plan4: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/reseaux/structure?chronique=${chronique.key}`)
      .then((r) => r.json())
      .then((d) => { if (alive && d.success) setS(d.structure) })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [chronique.key])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/reseaux/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chronique: chronique.key, ...s }),
      })
      const d = await res.json()
      if (!d.success) throw new Error(d.error)
      onClose()
    } catch (e: any) {
      alert(e?.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full font-sans border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#22209C]'
  const set = (k: keyof typeof s, v: string) => setS((x) => ({ ...x, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85dvh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">{chronique.titre}</div>
            <div className="text-xs text-gray-500">Structure</div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#22209C]" />
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Accroche</label>
              <textarea className={`${field} min-h-[60px]`} value={s.accroche} onChange={(e) => set('accroche', e.target.value)} />
            </div>
            {([1, 2, 3, 4] as const).map((n) => (
              <div key={n}>
                <label className="block text-xs font-medium text-gray-500 mb-1">Plan {n}</label>
                <textarea
                  className={`${field} min-h-[50px]`}
                  value={s[`plan${n}` as keyof typeof s]}
                  onChange={(e) => set(`plan${n}` as keyof typeof s, e.target.value)}
                />
              </div>
            ))}
            <button onClick={save} disabled={saving} className="w-full bg-[#22209C] text-white text-sm font-medium rounded-lg py-2.5 disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ChroniqueBody({ chronique, collabOptions, onCountsChange }: { chronique: Chronique; collabOptions: CollabOption[]; onCountsChange: () => void }) {
  const [productions, setProductions] = useState<Production[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/reseaux/contenu?chronique=${chronique.key}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.success) return
        // Pré-remplit la caption avec le défaut de la chronique tant qu'elle est vide.
        setProductions(
          d.productions.map((p: Production) => ({
            ...p,
            caption: p.caption || chronique.captionDefaut,
            heurePost: p.heurePost || chronique.heureDefaut,
            objectif: p.objectif || chronique.objectifDefaut,
            cta: p.cta || (chronique as any).ctaDefaut || '',
            format: p.format || chronique.formatDefaut,
            medias: p.medias || [],
          }))
        )
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [chronique.key, reloadKey])

  const [openDate, setOpenDate] = useState<string | null>(null)

  const updateProd = (updated: Production) =>
    setProductions((list) => list.map((x) => (x.date === updated.date ? updated : x)))

  const deleteProd = async (prod: Production) => {
    if (!confirm('Supprimer cette publi ? (le créneau redevient vide)')) return
    try {
      await fetch('/api/reseaux/contenu', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chronique: chronique.key, date: prod.date }),
      })
      setProductions((list) => list.map((x) => x.date === prod.date ? {
        ...x, theme: '', videoUrl: '', vignetteUrl: '', medias: [], status: '', pret: false,
      } : x))
      onCountsChange()
    } catch { alert('Erreur suppression') }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  const openProd = productions.find((p) => p.date === openDate) || null

  // On ne montre que les créneaux remplis (remontés en haut) + 1 tuile « + »
  // pour le prochain créneau libre (pas de tuiles vides qui traînent).
  const hasContent = (p: Production) =>
    !!(p.videoUrl || (p.medias && p.medias.length) || p.vignetteUrl || (p.theme && p.theme.trim()))
  const filled = productions.filter((p) => p.status !== 'published' && hasContent(p))
  const firstEmpty = productions.find((p) => p.status !== 'published' && !hasContent(p))

  return (
    <div>
      <div className="grid grid-cols-3 gap-x-[2px] gap-y-3">
        {filled.map((prod) => {
          const published = false
          const incomplet = !isComplete(prod)
          const prev = previewUrl(prod)
          return (
            <div key={prod.date} onClick={() => setOpenDate(prod.date)} className="text-left cursor-pointer">
              <div className="relative aspect-[4/5] overflow-hidden bg-gray-100 flex items-center justify-center">
                {prev && !prev.isVideo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={prev.url} alt="" className={`w-full h-full object-cover ${published ? 'opacity-70' : ''}`} style={{ objectPosition: `50% ${prod.vignetteOffsetY ?? 50}%` }} />
                ) : prev && prev.isVideo ? (
                  <video src={`${prev.url}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover" style={{ objectPosition: `50% ${prod.vignetteOffsetY ?? 50}%` }} />
                ) : (
                  <span className="text-4xl text-gray-300 leading-none">+</span>
                )}
                {published ? (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 shadow">Publié</span>
                ) : prev && (
                  <>
                    {incomplet && (
                      <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shadow">!</span>
                    )}
                    <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow">
                      <Pencil size={13} className="text-gray-600" />
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProd(prod) }}
                      className="absolute top-9 right-1.5 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow text-red-500 text-sm leading-none"
                      title="Supprimer"
                    >×</button>
                  </>
                )}
              </div>
              <div className="mt-1.5 text-[12px] leading-tight">
                {prod.theme && <div className="font-medium text-gray-700 truncate">{prod.theme}</div>}
                <div className="text-gray-400 capitalize">post du {frDate(prod.date)}</div>
              </div>
            </div>
          )
        })}
        {/* Tuile d'ajout : prochain créneau libre */}
        {firstEmpty && (
          <div onClick={() => setOpenDate(firstEmpty.date)} className="text-left cursor-pointer">
            <div className="aspect-[4/5] rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300 hover:border-[#22209C] hover:text-[#22209C]">
              <span className="text-4xl leading-none">+</span>
            </div>
            <div className="mt-1.5 text-[12px] leading-tight text-gray-400 capitalize">post du {frDate(firstEmpty.date)}</div>
          </div>
        )}
      </div>

      {openProd && (
        <ProductionModal
          chronique={chronique}
          prod={openProd}
          collabOptions={collabOptions}
          dates={productions.map((p) => p.date)}
          onClose={() => setOpenDate(null)}
          onSaved={(p) => { updateProd(p); onCountsChange(); setOpenDate(null) }}
          onSwapped={() => { setReloadKey((k) => k + 1); onCountsChange(); setOpenDate(null) }}
        />
      )}
    </div>
  )
}

function ProductionModal({
  chronique, prod, collabOptions, dates, onClose, onSaved, onSwapped,
}: {
  chronique: Chronique; prod: Production; collabOptions: CollabOption[]; dates: string[]; onClose: () => void; onSaved: (p: Production) => void; onSwapped: () => void
}) {
  const swapTo = async (targetDate: string) => {
    if (!targetDate || targetDate === prod.date) return
    try {
      const res = await fetch('/api/reseaux/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chronique: chronique.key, dateA: prod.date, dateB: targetDate }),
      })
      const d = await res.json()
      if (!d.success) throw new Error(d.error)
      onSwapped()
    } catch (e: any) {
      alert(e?.message || 'Erreur déplacement')
    }
  }
  const others = dates.filter((d) => d !== prod.date)
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88dvh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <div>
            <div className="text-sm font-semibold text-gray-900">{chronique.titre}</div>
            {/* Cliquer la date = déplacer/échanger vers un autre créneau */}
            {others.length > 0 && prod.status !== 'published' ? (
              <select
                value={prod.date}
                onChange={(e) => swapTo(e.target.value)}
                className="text-xs text-gray-500 bg-transparent capitalize -ml-0.5 focus:outline-none"
                title="Déplacer vers une autre date"
              >
                <option value={prod.date}>post du {frDate(prod.date)}</option>
                {others.map((d) => <option key={d} value={d}>→ déplacer au {frDate(d)}</option>)}
              </select>
            ) : (
              <div className="text-xs text-gray-500 capitalize">post du {frDate(prod.date)}</div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        <div className="px-4 pb-4">
          <ProductionCard chronique={chronique} prod={prod} onSaved={onSaved} collabOptions={collabOptions} />
        </div>
      </div>
    </div>
  )
}

type Post = {
  id: string
  imageUrl?: string
  permalink: string
  isVideo?: boolean
  isReel?: boolean
  isAlbum?: boolean
}

export default function ReseauxPage() {
  const [activeTab, setActiveTab] = useState<Tab>('contenu')
  const [reseau, setReseau] = useState<Reseau>('ig')
  const [posts, setPosts] = useState<Post[]>([])
  const [tiktokPosts, setTiktokPosts] = useState<Post[]>([])
  const [planned, setPlanned] = useState<{ date: string; chronique: string; vignetteUrl: string; videoUrl: string; offsetY?: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [collabOptions, setCollabOptions] = useState<CollabOption[]>([])
  const [structureFor, setStructureFor] = useState<Chronique | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const todayDow = new Date().getDay()

  const refreshCounts = useCallback(() => {
    fetch('/api/reseaux/counts')
      .then((r) => r.json())
      .then((d) => { if (d.success) setCounts(d.counts) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    fetch('/api/reseaux/collab-options')
      .then((r) => r.json())
      .then((d) => { if (alive && d.success) setCollabOptions(d.options) })
      .catch(() => {})
    refreshCounts()
    return () => { alive = false }
  }, [refreshCounts])

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      fetch('/api/reseaux/ig-feed').then((r) => r.json()),
      fetch('/api/reseaux/feed-hidden').then((r) => r.json()).catch(() => ({ ids: [] })),
      fetch('/api/reseaux/planned', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ planned: [] })),
      fetch('/api/reseaux/tiktok-feed').then((r) => r.json()).catch(() => ({ posts: [] })),
    ])
      .then(([feed, h, pl, tk]) => {
        if (!alive) return
        if (feed.success) setPosts(feed.posts.filter((p: Post) => p.imageUrl))
        else setError(feed.error || 'Erreur')
        if (h?.ids) setHidden(new Set(h.ids))
        if (pl?.planned) setPlanned(pl.planned)
        if (tk?.success && tk.posts) setTiktokPosts(tk.posts.filter((p: Post) => p.imageUrl))
      })
      .catch((e) => alive && setError(e?.message || 'Erreur'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  // Rafraîchit le contenu programmé à chaque ouverture de l'onglet Feed
  // (pour refléter suppressions/échanges faits dans New contenu).
  useEffect(() => {
    if (activeTab !== 'feed') return
    fetch('/api/reseaux/planned', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (d?.planned) setPlanned(d.planned) })
      .catch(() => {})
  }, [activeTab])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tabs sticky (même layout que /vendeuse/demandes-depot) */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('contenu')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'contenu'
                  ? 'border-[#22209C] text-[#22209C]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PlusSquare size={18} />
              <span>New contenu</span>
            </button>
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'feed'
                  ? 'border-[#22209C] text-[#22209C]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid size={18} />
              <span>Feed</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 py-4">
        {activeTab === 'contenu' && (
          <section className="space-y-2">
            <p className="text-sm text-gray-500 mb-3">
              Chaque jour sa chronique. Prépare ton contenu à l'avance : l'app te rappellera, le stockera et le postera le bon jour.
            </p>
            {CHRONIQUES.map((c) => {
              const isToday = c.day === todayDow
              const open = openKey === c.key
              return (
                <div key={c.key} className={`rounded-xl border overflow-hidden ${open ? 'border-[#22209C]' : isToday ? 'border-[#22209C]/50' : 'border-gray-200'}`}>
                  <div
                    className={`flex items-center justify-between gap-3 p-4 ${
                      open ? 'bg-[#22209C]/5' : isToday ? 'bg-[#22209C]/5' : 'bg-white'
                    }`}
                  >
                    <button onClick={() => setOpenKey(open ? null : c.key)} className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-semibold text-gray-900 truncate">{c.titre}</div>
                      <div className="text-sm text-gray-500">
                        {c.jour} - {c.responsable}
                        {isToday && <span className="ml-2 text-xs font-medium text-[#22209C]">· Aujourd'hui</span>}
                      </div>
                    </button>
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <span
                        className={`w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center ${
                          (counts[c.key] ?? 0) < 2 ? 'bg-red-500' : 'bg-[#22209C]'
                        }`}
                        title={`${counts[c.key] ?? 0} contenu(s) d'avance`}
                      >
                        {counts[c.key] ?? 0}
                      </span>
                      <button
                        onClick={() => setStructureFor(c)}
                        className="text-[11px] text-gray-400 hover:text-gray-600"
                      >
                        Structure
                      </button>
                    </div>
                  </div>
                  {open && (
                    <div className="border-t border-gray-100 px-4 pb-4 bg-white">
                      <ChroniqueBody chronique={c} collabOptions={collabOptions} onCountsChange={refreshCounts} />
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {activeTab === 'feed' && (
          <section>
            {/* Toggle IG/TikTok petit, à droite + connexion TikTok */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => { window.location.href = '/api/tiktok/auth' }}
                className="text-[11px] text-gray-400 hover:text-[#22209C]"
              >
                Connecter TikTok
              </button>
              <div className="inline-flex bg-gray-100 rounded-full p-0.5 text-[11px] font-medium">
                <button
                  onClick={() => setReseau('ig')}
                  className={`px-2.5 py-0.5 rounded-full transition-colors ${
                    reseau === 'ig' ? 'bg-white text-[#22209C] shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Insta
                </button>
                <button
                  onClick={() => setReseau('tiktok')}
                  className={`px-2.5 py-0.5 rounded-full transition-colors ${
                    reseau === 'tiktok' ? 'bg-white text-[#22209C] shadow-sm' : 'text-gray-500'
                  }`}
                >
                  TikTok
                </button>
              </div>
            </div>

            {/* Grille preview */}
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
              </div>
            ) : error ? (
              <p className="text-center text-red-500 py-12">{error}</p>
            ) : (reseau === 'ig' ? posts : (tiktokPosts.length ? tiktokPosts : posts)).length === 0 && planned.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Aucun post.</p>
            ) : (
              <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen max-w-[600px] sm:mx-auto sm:left-0 sm:right-0">
              <div className="grid grid-cols-3 gap-[2px] bg-white">
                {/* Contenu programmé (au-dessus des vrais posts, ordre de publication) */}
                {planned.map((p) => (
                  <div
                    key={`plan-${p.chronique}-${p.date}`}
                    className={`relative bg-gray-100 overflow-hidden ring-2 ring-inset ring-[#22209C]/40 ${reseau === 'ig' ? 'aspect-[4/5]' : 'aspect-[9/16]'}`}
                  >
                    {p.vignetteUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.vignetteUrl} alt="" className="w-full h-full object-cover" style={{ objectPosition: `50% ${p.offsetY ?? 50}%` }} loading="lazy" />
                    ) : p.videoUrl ? (
                      <video src={`${p.videoUrl}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover" style={{ objectPosition: `50% ${p.offsetY ?? 50}%` }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">+</div>
                    )}
                    <span className="absolute bottom-1 left-1 text-white/80 text-[8px] font-normal capitalize drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                      {frDate(p.date)}
                    </span>
                  </div>
                ))}
                {(reseau === 'ig' ? posts : (tiktokPosts.length ? tiktokPosts : posts)).filter((p) => !hidden.has(p.id)).map((p) => (
                  <a
                    key={p.id}
                    href={p.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className={`relative block bg-gray-100 overflow-hidden ${reseau === 'ig' ? 'aspect-[4/5]' : 'aspect-[9/16]'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    {(p.isReel || p.isVideo) && (
                      <Play size={16} className="absolute top-1.5 right-1.5 text-white drop-shadow" fill="white" />
                    )}
                    {p.isAlbum && (
                      <Copy size={15} className="absolute top-1.5 right-1.5 text-white drop-shadow" />
                    )}
                  </a>
                ))}
              </div>
              </div>
            )}
          </section>
        )}
      </div>

      {structureFor && <StructureModal chronique={structureFor} onClose={() => setStructureFor(null)} />}
    </div>
  )
}
