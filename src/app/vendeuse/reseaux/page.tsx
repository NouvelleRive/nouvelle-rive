'use client'

import { useEffect, useState, useCallback } from 'react'
import { PlusSquare, LayoutGrid, Play, Copy, Pencil } from 'lucide-react'
import { storage } from '@/lib/firebaseConfig'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

type Tab = 'contenu' | 'feed'
type Reseau = 'ig' | 'tiktok'

// Les 7 chroniques de la semaine (une par jour, une par fille).
// day = getDay() : 0 = dimanche … 6 = samedi.
const CHRONIQUES = [
  {
    key: 'infinite-slider', day: 0, jour: 'Dimanche', titre: 'INFINITE SLIDER', responsable: 'Salomé',
    captionDefaut: "Les nouveautés de la semaine défilent 🌊\n\nLaquelle repart avec toi ? 🦋",
  },
  {
    key: 'compo-de-lo', day: 1, jour: 'Lundi', titre: 'LES COMPO DE LO', responsable: 'Loah',
    captionDefaut: "Avec quoi on porte un (sublime) XX ? On en appelle à l'oeil de Lo. Ci-dessus nos plus belles compo.\nToutes ces pépites sont disponibles chez 🌊NOUVELLE RIVE, sur le site et en boutique.\n\nWhat do you wear a (stunning) XX with? We call on Lo's eye. Above, our most beautiful combos.\nAll these gems are available at 🌊NOUVELLE RIVE, online and in store.\n\n🌊www.nouvellerive.eu\n🌊8 rue des Ecouffes Paris le Marais",
  },
  {
    key: 'book-olga', day: 2, jour: 'Mardi', titre: "LE BOOK D'OLGA", responsable: 'Olga',
    captionDefaut: "Le book d'Olga 📖 sa sélection coup de cœur de la semaine\n\nDis-nous ta préférée 🦋",
  },
  {
    key: 'le-rideau', day: 3, jour: 'Mercredi', titre: 'LE RIDEAU', responsable: 'Amanda',
    captionDefaut: "Que portent nos stars du vintage ? C'est la mission d'Amanda de le découvrir 🕵️‍♀️🔎🌊\n\nSpoiler ce sera local et de saison 🦋",
  },
  {
    key: 'microboutique-hina', day: 4, jour: 'Jeudi', titre: "LA MICROBOUTIQUE D'HINA", responsable: 'Hina',
    captionDefaut: "La microboutique d'Hina 🛍️ ses trouvailles à shopper avant tout le monde\n\nÇa part vite 🦋",
  },
  {
    key: 'shabbat-quote', day: 5, jour: 'Vendredi', titre: 'SHABBAT QUOTE', responsable: 'Salomé',
    captionDefaut: "Shabbat Shalom 🌊 la quote de la semaine pour bien commencer le week-end 🦋",
  },
  {
    key: 'energies-sarah', day: 6, jour: 'Samedi', titre: 'LES ENERGIES DE SARAH', responsable: 'Sarah',
    captionDefaut: "Les énergies de Sarah ✨ sa pièce vibe du moment\n\nElle est pour toi ? 🦋",
  },
] as const

type Chronique = (typeof CHRONIQUES)[number]

type Production = {
  date: string
  theme: string
  objectif: string
  videoUrl: string
  vignetteUrl: string
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
  return [p.theme, p.objectif, p.videoUrl, p.vignetteUrl, p.caption, p.heurePost, p.cta, p.lieu]
    .every((v) => !!(v && v.trim()))
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

function ProductionCard({ chronique, prod, onSaved, collabOptions }: { chronique: Chronique; prod: Production; onSaved: (p: Production) => void; collabOptions: CollabOption[] }) {
  const [p, setP] = useState<Production>(prod)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)

  useEffect(() => setP(prod), [prod])
  const set = (k: keyof Production, v: string) => setP((x) => ({ ...x, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/reseaux/contenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chronique: chronique.key, ...p }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const updated = { ...p, pret: !!p.videoUrl }
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

  const onVignetteFile = async (file: File) => {
    setBusy('vignette')
    try { set('vignetteUrl', await uploadMedia(file, 'vignette')) }
    catch (e: any) { alert(e?.message) }
    finally { setBusy(null) }
  }

  const grabFrame = async () => {
    if (!videoEl) return
    setBusy('vignette')
    try {
      const frame = await captureFrame(videoEl)
      set('vignetteUrl', await uploadMedia(frame, 'vignette'))
    } catch (e: any) { alert(e?.message) }
    finally { setBusy(null) }
  }

  const input = 'w-full font-sans border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#22209C]'
  const label = 'block text-sm font-medium text-gray-600 mb-1'

  return (
    <div className="pt-4 first:pt-0 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 capitalize">{frDate(p.date)}</span>
        <span className={`text-xs font-medium rounded-full px-3 py-1 ${p.videoUrl ? 'text-green-700 bg-green-50' : 'text-amber-600 bg-amber-50'}`}>
          {p.videoUrl ? 'Prêt' : 'À faire'}
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

      {/* Vidéo + vignette côte à côte */}
      <div>
        <label className={label}>Vidéo (postée avec le son) & vignette</label>
        <div className="flex gap-3 items-start">
          {/* Vidéo à son format naturel (16/9 ou portrait), sans bandes */}
          <div className="flex-1 min-w-0">
            {p.videoUrl ? (
              <div className="relative inline-block">
                <video ref={setVideoEl} src={p.videoUrl} controls className="max-h-64 max-w-full rounded-lg" />
                <button
                  onClick={() => set('videoUrl', '')}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-sm leading-none flex items-center justify-center"
                  title="Supprimer la vidéo"
                >
                  ×
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 py-8 border border-dashed border-gray-300 rounded-lg cursor-pointer text-gray-300 hover:border-[#22209C] hover:text-[#22209C]">
                {busy === 'video' ? <span className="text-sm text-gray-400">Envoi…</span> : <span className="text-5xl leading-none">+</span>}
                <span className="text-xs text-gray-400">Vidéo</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && onVideo(e.target.files[0])} />
              </label>
            )}
          </div>
          {/* Vignette à côté */}
          <div className="shrink-0">
            {p.vignetteUrl ? (
              <div className="relative w-20 h-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.vignetteUrl} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                <button
                  onClick={() => set('vignetteUrl', '')}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center"
                  title="Supprimer la vignette"
                >
                  ×
                </button>
              </div>
            ) : (
              <label className="w-20 h-20 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center gap-0.5 text-gray-300 cursor-pointer hover:border-[#22209C] hover:text-[#22209C]">
                {busy === 'vignette' ? <span className="text-[10px] text-gray-400">Envoi…</span> : <span className="text-3xl leading-none">+</span>}
                <span className="text-[10px] text-gray-400">Vignette</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onVignetteFile(e.target.files[0])} />
              </label>
            )}
          </div>
        </div>
        {p.videoUrl && (
          <div className="mt-2">
            <button onClick={grabFrame} disabled={busy === 'vignette'} className="text-xs font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5">
              {busy === 'vignette' ? '…' : 'Vignette = image actuelle de la vidéo'}
            </button>
          </div>
        )}
      </div>

      <div>
        <label className={label}>Caption</label>
        <textarea className={`${input} min-h-[260px]`} value={p.caption} onChange={(e) => set('caption', e.target.value)} placeholder="Légende du post" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Heure de post</label>
          <input type="time" className="font-sans border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-[#22209C]" value={p.heurePost} onChange={(e) => set('heurePost', e.target.value)} />
        </div>
        <div>
          <label className={label}>CTA</label>
          <input className={`${input} min-w-0`} value={p.cta} onChange={(e) => set('cta', e.target.value)} placeholder="Appel à l'action" />
        </div>
      </div>
      <div>
        <label className={label}>Lieu</label>
        <input className={input} value={p.lieu} onChange={(e) => set('lieu', e.target.value)} />
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
                {hasHandle(p.collab, o.handle) ? '✓ ' : ''}{o.nom} (@{o.handle})
              </option>
            ))}
          </select>
        )}
        <input
          className={input}
          value={p.collab}
          onChange={(e) => set('collab', e.target.value)}
          placeholder="@compte1, @compte2"
        />
        <p className="text-[11px] text-gray-400 mt-1">Choisis une chineuse dans la liste, ou tape n'importe quel @compte (séparés par une virgule).</p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-[#22209C] text-white text-sm font-medium rounded-lg py-2.5 disabled:opacity-50"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
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
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/reseaux/contenu?chronique=${chronique.key}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.success) return
        // Pré-remplit la caption avec le défaut de la chronique tant qu'elle est vide.
        setProductions(
          d.productions.map((p: Production) => ({ ...p, caption: p.caption || chronique.captionDefaut }))
        )
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [chronique.key])

  const [openDate, setOpenDate] = useState<string | null>(null)

  const updateProd = (updated: Production) =>
    setProductions((list) => list.map((x) => (x.date === updated.date ? updated : x)))

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  const openProd = productions.find((p) => p.date === openDate) || null

  return (
    <div>
      <div className="grid grid-cols-3 gap-x-[2px] gap-y-3">
        {productions.map((prod) => {
          const published = prod.status === 'published'
          const incomplet = !published && !isComplete(prod)
          return (
            <button key={prod.date} onClick={() => setOpenDate(prod.date)} className="text-left">
              <div className="relative aspect-[4/5] overflow-hidden bg-gray-100 flex items-center justify-center">
                {prod.vignetteUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={prod.vignetteUrl} alt="" className={`w-full h-full object-cover ${published ? 'opacity-70' : ''}`} />
                ) : prod.videoUrl ? (
                  // Pas de vignette → 1ʳᵉ image de la vidéo
                  <video src={`${prod.videoUrl}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl text-gray-300 leading-none">+</span>
                )}
                {published ? (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 shadow">Publié</span>
                ) : prod.pret && (
                  <>
                    {incomplet && (
                      <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shadow">!</span>
                    )}
                    <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow">
                      <Pencil size={13} className="text-gray-600" />
                    </span>
                  </>
                )}
              </div>
              <div className="mt-1.5 text-[12px] leading-tight">
                {prod.theme && <div className="font-medium text-gray-700 truncate">{prod.theme}</div>}
                <div className="text-gray-400 capitalize">post du {frDate(prod.date)}</div>
              </div>
            </button>
          )
        })}
      </div>

      {openProd && (
        <ProductionModal
          chronique={chronique}
          prod={openProd}
          collabOptions={collabOptions}
          onClose={() => setOpenDate(null)}
          onSaved={(p) => { updateProd(p); onCountsChange(); setOpenDate(null) }}
        />
      )}
    </div>
  )
}

function ProductionModal({
  chronique, prod, collabOptions, onClose, onSaved,
}: {
  chronique: Chronique; prod: Production; collabOptions: CollabOption[]; onClose: () => void; onSaved: (p: Production) => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <div>
            <div className="text-sm font-semibold text-gray-900">{chronique.titre}</div>
            <div className="text-xs text-gray-500 capitalize">post du {frDate(prod.date)}</div>
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
    ])
      .then(([feed, h]) => {
        if (!alive) return
        if (feed.success) setPosts(feed.posts.filter((p: Post) => p.imageUrl))
        else setError(feed.error || 'Erreur')
        if (h?.ids) setHidden(new Set(h.ids))
      })
      .catch((e) => alive && setError(e?.message || 'Erreur'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

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
                      <div className="font-semibold text-gray-900 truncate">{c.titre}</div>
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
            {/* Toggle IG/TikTok petit, à droite */}
            <div className="flex items-center justify-end mb-3">
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
            ) : posts.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Aucun post.</p>
            ) : (
              <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen max-w-[600px] sm:mx-auto sm:left-0 sm:right-0">
              <div className="grid grid-cols-3 gap-[2px] bg-white">
                {posts.filter((p) => !hidden.has(p.id)).map((p) => (
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
