'use client'

import { useEffect, useState } from 'react'
import { PlusSquare, LayoutGrid, Play, Copy } from 'lucide-react'

type Tab = 'contenu' | 'feed'
type Reseau = 'ig' | 'tiktok'

type Post = {
  id: string
  imageUrl?: string
  permalink: string
  isVideo?: boolean
  isAlbum?: boolean
}

export default function ReseauxPage() {
  const [activeTab, setActiveTab] = useState<Tab>('feed')
  const [reseau, setReseau] = useState<Reseau>('ig')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          <section>
            <p className="text-center text-gray-400 py-12">New contenu — à venir.</p>
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
