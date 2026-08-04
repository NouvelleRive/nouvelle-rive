'use client'

// Popup « next fav » hebdo : s'affiche tout seul dans l'admin quand les 5 pièces
// fond blanc de la semaine sont prêtes (statut pending). On choisit une pièce,
// on ajuste la légende + la ligne bio, on valide → publication auto le mercredi.
//
// Monté dans le layout admin. Pull, pas push : une seule requête au chargement.
// « Plus tard » masque le popup pour la session (réapparaît au prochain passage).

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import { formatPrixEuro } from '@/lib/formatPrix'

type Candidate = {
  productId: string
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
  caption?: string
  bioLine?: string
}

async function authedFetch(url: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  return res.json()
}

export default function IgWeeklyPopup() {
  const [doc, setDoc] = useState<WeeklyDoc | null>(null)
  const [weekId, setWeekId] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [bioLine, setBioLine] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return
      const data = await authedFetch('/api/admin/instagram-weekly')
      if (!data.success || !data.doc) return
      setWeekId(data.weekId)
      setDoc(data.doc)
      const dismissed = sessionStorage.getItem(`ig-weekly-dismissed-${data.weekId}`)
      if (data.doc.status === 'pending' && data.doc.candidates?.length && !dismissed) {
        setOpen(true)
      }
    })
    return () => unsub()
  }, [])

  // Légende + bio par défaut selon la pièce sélectionnée
  useEffect(() => {
    if (!doc || !selected) return
    const c = doc.candidates.find((x) => x.productId === selected)
    if (!c) return
    const titre = [c.marque, c.nom].filter(Boolean).join(' · ')
    setCaption(
      [titre, c.prix ? `${c.prix}€` : '', '', "🔗 next fav en bio pour l'acheter", c.boutiqueUrl, '', '#nouvellerive #secondemain #vintage #upcycling #modecirculaire #paris'].join('\n')
    )
    const label = [c.marque, c.nom].filter(Boolean).join(' ') || 'la pièce de la semaine'
    setBioLine(`next fav : ${label}`)
  }, [selected, doc])

  const dismiss = () => {
    if (weekId) sessionStorage.setItem(`ig-weekly-dismissed-${weekId}`, '1')
    setOpen(false)
  }

  const act = async (action: string, extra?: Record<string, any>) => {
    setBusy(action)
    const data = await authedFetch('/api/admin/instagram-weekly', {
      method: 'POST',
      body: JSON.stringify({ action, ...extra }),
    })
    setBusy(null)
    if (!data.success) { alert(data.error || 'Erreur'); return }
    if (action === 'regenerate') { setDoc(data.doc); setSelected(null); return }
    // choose / skip → on ferme
    setDone(true)
    setTimeout(() => setOpen(false), action === 'choose' ? 1400 : 300)
  }

  if (!open || !doc) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={dismiss}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-semibold text-[#22209C]">C'est validé — le post part mercredi.</div>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-bold text-[#22209C]">📸 Ta pièce Instagram de la semaine</h2>
              <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Choisis-en une, elle sera postée mercredi avec le lien boutique.
            </p>

            {/* Candidats */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
              {doc.candidates.map((c) => {
                const active = selected === c.productId
                return (
                  <button
                    key={c.productId}
                    onClick={() => setSelected(c.productId)}
                    className={`text-left rounded-lg overflow-hidden border-2 transition-all bg-white ${
                      active ? 'border-[#22209C] ring-2 ring-[#22209C]/20' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.imageUrl} alt={c.nom} className="w-full aspect-square object-cover bg-white" />
                    <div className="p-1.5">
                      <div className="text-[10px] font-semibold text-gray-800 truncate">{c.marque || '—'}</div>
                      <div className="text-[10px] text-[#22209C]">{formatPrixEuro(c.prix)}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {selected && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Légende</label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={5}
                    className="w-full border border-gray-300 rounded p-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ligne de bio « next fav »</label>
                  <input
                    value={bioLine}
                    onChange={(e) => setBioLine(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mt-5">
              <button
                onClick={() => selected && act('choose', { productId: selected, caption, bioLine })}
                disabled={!selected || !!busy}
                className="text-sm px-4 py-2 rounded bg-[#22209C] text-white font-medium hover:bg-[#1a1875] disabled:opacity-40"
              >
                {busy === 'choose' ? '…' : '✓ Valider pour mercredi'}
              </button>
              <button
                onClick={() => act('regenerate')}
                disabled={!!busy}
                className="text-sm px-3 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === 'regenerate' ? '…' : '↻ 5 autres'}
              </button>
              <button
                onClick={() => { if (confirm('Passer cette semaine sans publier ?')) act('skip') }}
                disabled={!!busy}
                className="text-sm px-3 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Passer
              </button>
              <button onClick={dismiss} className="text-sm px-3 py-2 rounded text-gray-500 hover:bg-gray-50 ml-auto">
                Plus tard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
