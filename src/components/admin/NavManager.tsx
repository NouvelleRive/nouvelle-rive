'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { Eye, EyeOff, ArrowUp, ArrowDown, Trash2, Save, Plus, Lock } from 'lucide-react'
import { NAV_DOC_ID, seedNavFromStatic, type NavPage } from '@/lib/nav-config'

export default function NavManager() {
  const [pages, setPages] = useState<NavPage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'siteConfig', NAV_DOC_ID))
        if (snap.exists() && Array.isArray(snap.data().pages)) {
          setPages(snap.data().pages as NavPage[])
        } else {
          setPages(seedNavFromStatic())
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function update(next: NavPage[]) {
    setPages(next)
    setDirty(true)
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= pages.length) return
    const next = [...pages]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    update(next.map((p, i) => ({ ...p, navOrder: i + 1 })))
  }

  function toggleHidden(idx: number) {
    const next = [...pages]
    next[idx] = { ...next[idx], hidden: !next[idx].hidden }
    update(next)
  }

  function rename(idx: number, field: 'labelFr' | 'labelEn', val: string) {
    const next = [...pages]
    next[idx] = { ...next[idx], [field]: val }
    update(next)
  }

  function remove(idx: number) {
    const p = pages[idx]
    if (p.isBuiltin) {
      if (!confirm(`"${p.labelFr}" est une page en dur : on la masque de la navbar (la route reste vivante). OK ?`)) return
      const next = [...pages]
      next[idx] = { ...next[idx], hidden: true }
      update(next)
      return
    }
    if (!confirm(`Supprimer "${p.labelFr}" définitivement ?`)) return
    update(pages.filter((_, i) => i !== idx).map((p, i) => ({ ...p, navOrder: i + 1 })))
  }

  function addPage() {
    const labelFr = prompt('Nom de la page (FR) :')?.trim()
    if (!labelFr) return
    const slug = prompt('Slug URL (ex: soldes) :')?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    if (!slug) return
    if (pages.some(p => p.id === slug)) {
      alert('Ce slug existe déjà.')
      return
    }
    const newPage: NavPage = {
      id: slug,
      path: `/p/${slug}`,
      labelFr,
      labelEn: labelFr,
      navOrder: pages.length + 1,
      hidden: false,
      isBuiltin: false,
      configurable: true,
    }
    update([...pages, newPage])
    alert('Page ajoutée. Note : la route publique /p/[slug] devra être créée en code pour l\'afficher.')
  }

  async function save() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'siteConfig', NAV_DOC_ID), {
        pages,
        updatedAt: new Date(),
      })
      setDirty(false)
      alert('✅ Navigation sauvegardée')
    } catch (e) {
      console.error(e)
      alert('❌ Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-6 text-sm text-gray-500">Chargement navigation…</div>

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#22209C]">Navigation & pages</h2>
        <div className="flex gap-2">
          <button
            onClick={addPage}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[#22209C] text-[#22209C] rounded hover:bg-[#22209C] hover:text-white"
          >
            <Plus size={14} /> Nouvelle page
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#22209C] text-white rounded disabled:opacity-40"
          >
            <Save size={14} /> {saving ? '…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Réordonne, masque, renomme. 🔒 = page en dur (suppression = masquage). Sans 🔒 = page créée depuis l'admin.
      </div>

      <div className="border-t">
        {pages.map((p, idx) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 py-2 border-b last:border-b-0 ${p.hidden ? 'opacity-50' : ''}`}
          >
            <div className="flex flex-col">
              <button
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="text-gray-400 hover:text-[#22209C] disabled:opacity-20"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => move(idx, 1)}
                disabled={idx === pages.length - 1}
                className="text-gray-400 hover:text-[#22209C] disabled:opacity-20"
              >
                <ArrowDown size={14} />
              </button>
            </div>

            <div className="w-6 flex justify-center">
              {p.isBuiltin && <Lock size={12} className="text-gray-400" />}
            </div>

            <button
              onClick={() => toggleHidden(idx)}
              className="text-gray-500 hover:text-[#22209C]"
              title={p.hidden ? 'Afficher dans la navbar' : 'Masquer de la navbar'}
            >
              {p.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>

            <div className="w-40 text-xs text-gray-500 truncate font-mono">{p.path}</div>

            <input
              value={p.labelFr}
              onChange={(e) => rename(idx, 'labelFr', e.target.value)}
              placeholder="Label FR"
              className="flex-1 min-w-0 border rounded px-2 py-1 text-sm"
            />
            <input
              value={p.labelEn}
              onChange={(e) => rename(idx, 'labelEn', e.target.value)}
              placeholder="Label EN"
              className="flex-1 min-w-0 border rounded px-2 py-1 text-sm"
            />

            <button
              onClick={() => remove(idx)}
              className="text-gray-400 hover:text-red-600"
              title={p.isBuiltin ? 'Masquer' : 'Supprimer'}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
