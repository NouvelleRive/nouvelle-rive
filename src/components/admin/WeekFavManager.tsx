'use client'

// Week fav (coups de cœur équipe) — vue admin pour AMENDER la sélection posée
// par les chineuses au restock (champ `favoriEquipe` sur produits/{id}).
// On peut ajouter une pièce (par SKU) ou en retirer. Les favs sont regroupés
// par semaine via `favoriEquipeAt` → mémoire des semaines précédentes.
//
// Lecture ciblée (where favoriEquipe==true) réservée à l'admin : peu de docs,
// pas un scan de collection.

import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, where, getDocs, getDoc, doc, updateDoc, increment,
} from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { Heart, X, Plus } from 'lucide-react'
import { formatPrixEuro } from '@/lib/formatPrix'

type Fav = {
  id: string
  sku?: string
  nom?: string
  marque?: string
  prix?: number
  imageUrls?: string[]
  imageUrl?: string
  favoriEquipeAt?: any
}

function favImage(f: Fav): string {
  if (f.imageUrls && f.imageUrls.length > 0) return f.imageUrls[0]
  return f.imageUrl || ''
}

// Purge le cache (blob + edge) pour que la page publique « Nos pièces préférées »
// (/coups-de-coeur, source = favoriEquipe) reflète l'ajout/retrait tout de suite.
async function refreshCache(productId: string) {
  try {
    await fetch('/api/cache/refresh-produits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: [productId] }),
    })
  } catch { /* best effort — l'ISR 1h finira le job */ }
}

// Lundi (00h) de la semaine d'une date donnée → clé de regroupement stable.
function mondayOf(d: Date): Date {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // 0 = lundi
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - day)
  return x
}

function toDate(v: any): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v?.toDate === 'function') return v.toDate()
  if (typeof v === 'number') return new Date(v)
  const s = v._seconds ?? v.seconds
  if (typeof s === 'number') return new Date(s * 1000)
  return null
}

function weekLabel(d: Date | null): string {
  if (!d) return 'Semaine indéterminée'
  const lundi = mondayOf(d)
  return `Semaine du ${lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
}

export default function WeekFavManager() {
  const [favs, setFavs] = useState<Fav[]>([])
  const [loading, setLoading] = useState(true)
  const [skuInput, setSkuInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'produits'), where('favoriEquipe', '==', true))
      )
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Fav[]
      setFavs(list)
    } catch (err) {
      console.error('load week fav error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const addBySku = async () => {
    const sku = skuInput.trim().toUpperCase()
    if (!sku || adding) return
    setAdding(true)
    try {
      // 1) recherche par champ sku ; 2) fallback : le SKU est le doc id.
      let found: { id: string; data: any } | null = null
      const q = await getDocs(
        query(collection(db, 'produits'), where('sku', '==', sku))
      )
      if (!q.empty) {
        found = { id: q.docs[0].id, data: q.docs[0].data() }
      } else {
        const byId = await getDoc(doc(db, 'produits', sku))
        if (byId.exists()) found = { id: byId.id, data: byId.data() }
      }
      if (!found) { alert(`Aucune pièce trouvée pour le SKU "${sku}".`); return }
      if (found.data.favoriEquipe === true) {
        alert('Cette pièce est déjà en week fav.')
        setSkuInput('')
        return
      }
      await updateDoc(doc(db, 'produits', found.id), {
        favoriEquipe: true,
        favoriEquipeAt: new Date(),
        likesCount: increment(1),
      })
      await refreshCache(found.id)
      setSkuInput('')
      await load()
    } catch (err: any) {
      console.error('addBySku error:', err)
      alert('Erreur : ' + (err?.message || ''))
    } finally {
      setAdding(false)
    }
  }

  const removeFav = async (f: Fav) => {
    if (busyId) return
    setBusyId(f.id)
    try {
      await updateDoc(doc(db, 'produits', f.id), {
        favoriEquipe: false,
        likesCount: increment(-1),
      })
      await refreshCache(f.id)
      setFavs(prev => prev.filter(x => x.id !== f.id))
    } catch (err: any) {
      console.error('removeFav error:', err)
      alert('Erreur : ' + (err?.message || ''))
    } finally {
      setBusyId(null)
    }
  }

  // Regroupement par semaine (favoriEquipeAt), plus récent en premier.
  const groups = (() => {
    const map = new Map<string, { ts: number; label: string; items: Fav[] }>()
    for (const f of favs) {
      const d = toDate(f.favoriEquipeAt)
      const key = d ? mondayOf(d).toISOString().slice(0, 10) : 'z-inconnue'
      const ts = d ? mondayOf(d).getTime() : -1
      if (!map.has(key)) map.set(key, { ts, label: weekLabel(d), items: [] })
      map.get(key)!.items.push(f)
    }
    return Array.from(map.values()).sort((a, b) => b.ts - a.ts)
  })()

  return (
    <div className="bg-white border rounded-lg p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Heart size={18} className="text-[#22209C]" fill="#22209C" />
        <h2 className="text-base font-bold text-[#22209C]">Week fav</h2>
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Les chineuses sélectionnent leurs favs au restock. Tu peux en ajouter ou en retirer ici.
      </p>

      {/* Ajout par SKU */}
      <div className="flex items-center gap-2">
        <input
          value={skuInput}
          onChange={e => setSkuInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addBySku() }}
          placeholder="SKU (ex: PRI171)"
          className="border rounded px-3 py-2 text-sm font-mono w-48"
        />
        <button
          onClick={addBySku}
          disabled={adding || !skuInput.trim()}
          className="flex items-center gap-1.5 bg-[#22209C] text-white px-4 py-2 rounded text-sm font-medium hover:bg-[#1a1878] disabled:opacity-50"
        >
          <Plus size={16} /> {adding ? 'Ajout…' : 'Ajouter'}
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500 text-sm">Chargement…</div>
      ) : favs.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm border border-dashed rounded">
          Aucune week fav pour l'instant.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(g => (
            <div key={g.label}>
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-700 capitalize">{g.label}</h3>
                <span className="text-xs text-gray-400">{g.items.length} pièce{g.items.length > 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {g.items.map(f => (
                  <div key={f.id} className="relative rounded-lg overflow-hidden border border-gray-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={favImage(f)} alt={f.nom || ''} className="w-full aspect-square object-cover bg-white" />
                    <button
                      onClick={() => removeFav(f)}
                      disabled={busyId === f.id}
                      title="Retirer de la week fav"
                      className="absolute top-1 right-1 bg-white/90 hover:bg-white p-1 rounded-full shadow disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                    <div className="p-1.5">
                      <div className="text-[10px] font-semibold text-gray-800 truncate">{f.marque || '—'}</div>
                      <div className="text-[10px] text-gray-500 truncate">{f.sku || ''}</div>
                      <div className="text-[10px] text-[#22209C]">{formatPrixEuro(f.prix || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
