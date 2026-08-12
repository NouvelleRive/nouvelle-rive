'use client'

import { useEffect, useState } from 'react'
import { PlusSquare, LayoutGrid, Play, Copy } from 'lucide-react'

type Tab = 'contenu' | 'feed'
type Reseau = 'ig' | 'tiktok'

// Les 7 chroniques de la semaine (une par jour, une par fille).
// day = getDay() : 0 = dimanche … 6 = samedi.
const CHRONIQUES = [
  { day: 0, jour: 'Dimanche', titre: 'INFINITE SLIDER', responsable: 'Salomé' },
  { day: 1, jour: 'Lundi', titre: 'LES COMPO DE LO', responsable: 'Loah' },
  { day: 2, jour: 'Mardi', titre: "LE BOOK D'OLGA", responsable: 'Olga' },
  { day: 3, jour: 'Mercredi', titre: 'LE RIDEAU', responsable: 'Amanda' },
  { day: 4, jour: 'Jeudi', titre: "LA MICROBOUTIQUE D'HINA", responsable: 'Hina' },
  { day: 5, jour: 'Vendredi', titre: 'SHABBAT QUOTE', responsable: 'Salomé' },
  { day: 6, jour: 'Samedi', titre: 'LES ENERGIES DE SARAH', responsable: 'Sarah' },
] as const

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

      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'contenu' && (
          <section className="space-y-3">
            <p className="text-sm text-gray-500 mb-4">
              Chaque jour sa chronique. Prépare ton contenu à l'avance : l'app te rappellera, le stockera et le postera le bon jour.
            </p>
            {CHRONIQUES.map((c) => {
              const isToday = c.day === todayDow
              return (
                <div
                  key={c.day}
                  className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
                    isToday ? 'border-[#22209C] bg-[#22209C]/5' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${isToday ? 'text-[#22209C]' : 'text-gray-400'}`}>
                        {c.jour}
                      </span>
                      {isToday && (
                        <span className="text-[10px] font-bold text-white bg-[#22209C] rounded-full px-2 py-0.5">
                          Aujourd'hui
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-gray-900 truncate">{c.titre}</div>
                    <div className="text-sm text-gray-500">{c.responsable}</div>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-amber-600 bg-amber-50 rounded-full px-3 py-1">
                    À faire
                  </span>
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
              <div className="grid grid-cols-3 gap-0.5 bg-white p-0.5 rounded-lg overflow-hidden max-w-md mx-auto">
                {posts.map((p) => (
                  <a
                    key={p.id}
                    href={p.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className={`relative block bg-gray-100 overflow-hidden ${
                      reseau === 'ig' ? 'aspect-square' : 'aspect-[9/16]'
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
            )}
          </section>
        )}
      </div>
    </div>
  )
}
