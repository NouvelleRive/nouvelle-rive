'use client'

// /admin/instagram — validation du post Instagram « next fav » hebdo.
//
// L'app propose 4/5 pièces fond blanc (générées le mardi). On en choisit une,
// on ajuste la légende + la ligne de bio « next fav : … », et le post part
// automatiquement le mercredi (ou « Publier maintenant »).

import { useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import { formatPrixEuro } from '@/lib/formatPrix'

type Candidate = {
  productId: string
  sku?: string
  nom: string
  marque: string
  prix: number
  imageUrl: string
  boutiqueUrl: string
}

type WeeklyDoc = {
  weekOf: string
  status: 'pending' | 'chosen' | 'published' | 'skipped'
  candidates: Candidate[]
  chosenProductId?: string
  caption?: string
  bioLine?: string
  igMediaId?: string
  error?: string
}

const STATUS_LABEL: Record<WeeklyDoc['status'], string> = {
  pending: 'À valider',
  chosen: 'Validé — publication mercredi',
  published: 'Publié ✅',
  skipped: 'Semaine passée',
}

async function authedFetch(url: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  return res.json()
}

export default function InstagramWeeklyPage() {
  const [doc, setDoc] = useState<WeeklyDoc | null>(null)
  const [weekId, setWeekId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [bioLine, setBioLine] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await authedFetch('/api/admin/instagram-weekly')
    if (data.success) {
      setDoc(data.doc)
      setWeekId(data.weekId)
      const pick = data.doc.chosenProductId || data.doc.candidates?.[0]?.productId || null
      setSelected(pick)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { if (u) load() })
    return () => unsub()
  }, [load])

  // Recalcule légende/bio par défaut quand la pièce sélectionnée change,
  // sauf si l'utilisatrice a déjà validé (on garde son texte).
  useEffect(() => {
    if (!doc || !selected) return
    const c = doc.candidates.find((x) => x.productId === selected)
    if (!c) return
    if (doc.status === 'chosen' && doc.chosenProductId === selected) {
      setCaption(doc.caption || '')
      setBioLine(doc.bioLine || '')
    } else {
      const titre = [c.marque, c.nom].filter(Boolean).join(' · ')
      setCaption(
        [titre, c.prix ? `${c.prix}€` : '', '', c.sku ? `réf ${c.sku}` : '', "🔗 week fav en bio pour l'acheter", '', '#nouvellerive #secondemain #vintage #upcycling #modecirculaire #paris']
          .join('\n')
      )
      const label = [c.marque, c.nom].filter(Boolean).join(' ') || 'la pièce de la semaine'
      setBioLine(`week fav : ${label}`)
    }
  }, [selected, doc])

  const act = async (action: string, extra?: Record<string, any>) => {
    setBusy(action)
    const data = await authedFetch('/api/admin/instagram-weekly', {
      method: 'POST',
      body: JSON.stringify({ action, ...extra }),
    })
    setBusy(null)
    if (data.success && data.doc) {
      setDoc(data.doc)
      if (data.doc.chosenProductId) setSelected(data.doc.chosenProductId)
    } else if (!data.success) {
      alert(data.error || 'Erreur')
    }
  }

  const copy = (t: string) => navigator.clipboard?.writeText(t)

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
      </div>
    )
  }
  if (!doc) return <div className="py-10 text-gray-500">Rien à afficher.</div>

  const chosen = doc.candidates.find((c) => c.productId === (doc.chosenProductId || selected))
  const published = doc.status === 'published'

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold text-[#22209C]">Post Instagram de la semaine</h1>
        <span className={`text-xs px-3 py-1 rounded-full ${published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {STATUS_LABEL[doc.status]}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Mercredi {weekId?.split('-').reverse().join('/')} — choisis une pièce fond blanc, le post part tout seul.
      </p>

      {doc.error && (
        <div className="mb-4 text-sm bg-red-50 text-red-700 border border-red-200 rounded p-3">
          Dernière erreur de publication : {doc.error}
        </div>
      )}

      {/* Grille candidats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {doc.candidates.map((c) => {
          const active = selected === c.productId
          return (
            <button
              key={c.productId}
              onClick={() => !published && setSelected(c.productId)}
              disabled={published}
              className={`text-left rounded-lg overflow-hidden border-2 transition-all bg-white ${
                active ? 'border-[#22209C] ring-2 ring-[#22209C]/20' : 'border-gray-200 hover:border-gray-300'
              } ${published ? 'cursor-default opacity-90' : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imageUrl} alt={c.nom} className="w-full aspect-square object-cover bg-white" />
              <div className="p-2">
                <div className="text-[11px] font-semibold text-gray-800 truncate">{c.marque || '—'}</div>
                <div className="text-[11px] text-gray-500 truncate">{c.nom}</div>
                <div className="text-[11px] text-[#22209C] font-medium">{formatPrixEuro(c.prix)}</div>
              </div>
            </button>
          )
        })}
      </div>

      {!published && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => act('regenerate')}
            disabled={!!busy}
            className="text-sm px-3 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === 'regenerate' ? '…' : '↻ Proposer 5 autres'}
          </button>
          <button
            onClick={() => { if (confirm('Passer cette semaine sans publier ?')) act('skip') }}
            disabled={!!busy}
            className="text-sm px-3 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Passer la semaine
          </button>
        </div>
      )}

      {/* Édition légende + bio */}
      {chosen && (
        <div className="bg-white border rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Légende du post</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={published}
              rows={7}
              className="w-full border border-gray-300 rounded p-2 text-sm font-mono disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Ligne de bio (à coller dans les liens Instagram → pointe vers la boutique)
            </label>
            <div className="flex gap-2">
              <input
                value={bioLine}
                onChange={(e) => setBioLine(e.target.value)}
                disabled={published}
                className="flex-1 border border-gray-300 rounded p-2 text-sm disabled:bg-gray-50"
              />
              <button onClick={() => copy(bioLine)} className="text-xs px-3 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                Copier
              </button>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              Lien : <span className="font-mono">{chosen.boutiqueUrl}</span>{' '}
              <button onClick={() => copy(chosen.boutiqueUrl)} className="underline">copier</button>
            </div>
          </div>

          {!published ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => act('choose', { productId: chosen.productId, caption, bioLine })}
                disabled={!!busy}
                className="text-sm px-4 py-2 rounded bg-[#22209C] text-white font-medium hover:bg-[#1a1875] disabled:opacity-50"
              >
                {busy === 'choose' ? '…' : '✓ Valider pour mercredi'}
              </button>
              <button
                onClick={() => { if (confirm('Publier ce post maintenant sur Instagram ?')) act('publishNow') }}
                disabled={!!busy || doc.status !== 'chosen' || doc.chosenProductId !== chosen.productId}
                title={doc.status !== 'chosen' ? 'Valide d\'abord la pièce' : ''}
                className="text-sm px-4 py-2 rounded border border-[#22209C] text-[#22209C] font-medium hover:bg-[#22209C]/5 disabled:opacity-40"
              >
                {busy === 'publishNow' ? 'Publication…' : 'Publier maintenant'}
              </button>
            </div>
          ) : (
            <div className="text-sm text-green-700">
              Publié sur Instagram.{' '}
              {doc.igMediaId && <span className="text-gray-400">(media {doc.igMediaId})</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
