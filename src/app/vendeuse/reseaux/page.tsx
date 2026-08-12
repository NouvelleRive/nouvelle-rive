'use client'

import { useEffect, useState } from 'react'
import { PlusSquare, LayoutGrid, Play, Copy } from 'lucide-react'

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
    captionDefaut: "Les compo de Lo 🎨 Loah t'assemble une pièce forte en un look complet\n\nTu valides ? 🦋",
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
  pret: boolean
}

function frDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Réutilise l'endpoint Bunny partagé (/api/upload-bunny), branche multipart, dossier reseaux/.
async function uploadMedia(file: File, kind: 'video' | 'vignette'): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('folder', `reseaux/${kind}/`)
  const res = await fetch('/api/upload-bunny', { method: 'POST', body: fd })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || 'upload échoué')
  return data.url as string
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

function ProductionCard({ chronique, prod, onSaved }: { chronique: Chronique; prod: Production; onSaved: (p: Production) => void }) {
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

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#22209C]'
  const label = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 capitalize">{frDate(p.date)}</span>
        <span className={`text-xs font-medium rounded-full px-3 py-1 ${p.videoUrl ? 'text-green-700 bg-green-50' : 'text-amber-600 bg-amber-50'}`}>
          {p.videoUrl ? 'Prêt' : 'À faire'}
        </span>
      </div>

      <div>
        <label className={label}>Thème</label>
        <input className={input} value={p.theme} onChange={(e) => set('theme', e.target.value)} placeholder="Thème du jour" />
      </div>
      <div>
        <label className={label}>Objectif</label>
        <input className={input} value={p.objectif} onChange={(e) => set('objectif', e.target.value)} placeholder="Ce qu'on veut obtenir" />
      </div>

      {/* Vidéo */}
      <div>
        <label className={label}>Vidéo (postée avec le son)</label>
        {p.videoUrl ? (
          <video ref={setVideoEl} src={p.videoUrl} controls className="w-full max-h-72 rounded-lg bg-black" />
        ) : (
          <div className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-300 rounded-lg">Aucune vidéo</div>
        )}
        <div className="flex gap-2 mt-2">
          <label className="text-xs font-medium text-[#22209C] border border-[#22209C] rounded-lg px-3 py-1.5 cursor-pointer">
            {busy === 'video' ? 'Envoi…' : p.videoUrl ? 'Remplacer' : 'Ajouter la vidéo'}
            <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && onVideo(e.target.files[0])} />
          </label>
          {p.videoUrl && (
            <button onClick={grabFrame} disabled={busy === 'vignette'} className="text-xs font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5">
              {busy === 'vignette' ? '…' : 'Vignette = image actuelle'}
            </button>
          )}
        </div>
      </div>

      {/* Vignette */}
      <div>
        <label className={label}>Vignette</label>
        <div className="flex items-center gap-3">
          {p.vignetteUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.vignetteUrl} alt="" className="w-20 h-20 object-cover rounded-lg border" />
          ) : (
            <div className="w-20 h-20 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400">aucune</div>
          )}
          <label className="text-xs font-medium text-[#22209C] border border-[#22209C] rounded-lg px-3 py-1.5 cursor-pointer">
            {busy === 'vignette' ? 'Envoi…' : 'Importer'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onVignetteFile(e.target.files[0])} />
          </label>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">Sélectionne une image de la vidéo (bouton ci-dessus) ou importe-la.</p>
      </div>

      <div>
        <label className={label}>Caption</label>
        <textarea className={`${input} min-h-[80px]`} value={p.caption} onChange={(e) => set('caption', e.target.value)} placeholder="Légende du post" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Heure de post</label>
          <input type="time" className={input} value={p.heurePost} onChange={(e) => set('heurePost', e.target.value)} />
        </div>
        <div>
          <label className={label}>CTA</label>
          <input className={input} value={p.cta} onChange={(e) => set('cta', e.target.value)} placeholder="Appel à l'action" />
        </div>
      </div>
      <div>
        <label className={label}>Lieu</label>
        <input className={input} value={p.lieu} onChange={(e) => set('lieu', e.target.value)} />
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

function ChroniqueBody({ chronique }: { chronique: Chronique }) {
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

  const nbPrets = productions.filter((p) => p.pret).length
  const enAvance = nbPrets >= 2

  const updateProd = (updated: Production) =>
    setProductions((list) => list.map((x) => (x.date === updated.date ? updated : x)))

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className={`text-xs font-medium rounded-lg px-3 py-2 ${enAvance ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}>
        {enAvance
          ? `✓ ${nbPrets} semaines prêtes d'avance`
          : `⚠︎ ${nbPrets}/2 semaines prêtes — il en faut au moins 2 d'avance`}
      </div>
      {productions.map((prod) => (
        <ProductionCard key={prod.date} chronique={chronique} prod={prod} onSaved={updateProd} />
      ))}
    </div>
  )
}

type Post = {
  id: string
  imageUrl?: string
  permalink: string
  isVideo?: boolean
  isAlbum?: boolean
}

export default function ReseauxPage() {
  const [activeTab, setActiveTab] = useState<Tab>('contenu')
  const [reseau, setReseau] = useState<Reseau>('ig')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const todayDow = new Date().getDay()

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch('/api/reseaux/ig-feed')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d.success) setPosts(d.posts.filter((p: Post) => p.imageUrl))
        else setError(d.error || 'Erreur')
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
                  <button
                    onClick={() => setOpenKey(open ? null : c.key)}
                    className={`w-full text-left flex items-center justify-between p-4 transition-colors ${
                      open ? 'bg-[#22209C]/5' : isToday ? 'bg-[#22209C]/5' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${isToday ? 'text-[#22209C]' : 'text-gray-400'}`}>{c.jour}</span>
                        {isToday && (
                          <span className="text-[10px] font-bold text-white bg-[#22209C] rounded-full px-2 py-0.5">Aujourd'hui</span>
                        )}
                      </div>
                      <div className="font-semibold text-gray-900 truncate">{c.titre}</div>
                      <div className="text-sm text-gray-500">{c.responsable}</div>
                    </div>
                    <span className={`shrink-0 text-gray-400 text-xl transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                  </button>
                  {open && (
                    <div className="border-t border-gray-100 p-3 bg-gray-50">
                      <ChroniqueBody chronique={c} />
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {activeTab === 'feed' && (
          <section>
            {/* Toggle IG / TikTok */}
            <div className="flex justify-center mb-5">
              <div className="inline-flex bg-gray-100 rounded-full p-1">
                <button
                  onClick={() => setReseau('ig')}
                  className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    reseau === 'ig' ? 'bg-white text-[#22209C] shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Instagram
                </button>
                <button
                  onClick={() => setReseau('tiktok')}
                  className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${
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
                {posts.map((p) => (
                  <a
                    key={p.id}
                    href={p.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className={`relative block bg-gray-100 overflow-hidden ${
                      reseau === 'ig' ? 'aspect-[4/5]' : 'aspect-[9/16]'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    {p.isVideo && (
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
    </div>
  )
}
