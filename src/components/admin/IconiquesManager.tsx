'use client'

import { useState, useEffect, useRef } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { Eye, EyeOff, Plus, Trash2, Save, ArrowLeft, ImagePlus, X, Film, ArrowUp, ArrowDown } from 'lucide-react'

type IconiqueType = 'vintage' | 'upcy'

// ⚠️ Field DOIT rester au niveau module — s'il était défini dans le composant, sa
// référence changerait à chaque render → React démonterait/remonterait tous les inputs
// enfants → focus perdu à chaque frappe (bug historique).
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">{label}</div>
    {children}
  </label>
)

type Iconique = {
  id: string
  slug?: string
  nom: string
  nomEn?: string
  nomPluriel?: string
  nomPlurielEn?: string
  dateCreation?: string
  histoire?: string
  histoireEn?: string
  pourquoiMust?: string
  pourquoiMustEn?: string
  valeurNeuf?: number
  /** Borne haute optionnelle : si défini, affiché en fourchette "min € / max €". */
  valeurNeufMax?: number
  tendancePrix?: 'monte' | 'stable' | 'baisse'
  categorieRecherche?: string
  categoriesIn?: string[]
  marque?: string
  marquesIn?: string[]
  chineuseTrigrammes?: string[]
  materialContient?: string
  images?: string[]
  videos?: string[]
  videosLabel?: string
  videosLabelEn?: string
  ordre?: number
  type: IconiqueType
  displayOnWebsite?: boolean
  soldOut?: boolean
  buyLink?: string
}

const emptyDraft = (type: IconiqueType, ordre: number): Iconique => ({
  id: '',
  type,
  nom: '',
  nomEn: '',
  nomPluriel: '',
  nomPlurielEn: '',
  dateCreation: '',
  histoire: '',
  histoireEn: '',
  pourquoiMust: '',
  pourquoiMustEn: '',
  valeurNeuf: 0,
  tendancePrix: 'stable',
  categorieRecherche: '',
  categoriesIn: [],
  marque: '',
  marquesIn: [],
  chineuseTrigrammes: [],
  materialContient: '',
  images: [],
  videos: [],
  videosLabel: '',
  videosLabelEn: '',
  ordre,
  displayOnWebsite: true,
  soldOut: false,
  buyLink: '',
})

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      const maxDim = 1600
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = (height / width) * maxDim; width = maxDim }
        else { width = (width / height) * maxDim; height = maxDim }
      }
      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

export default function IconiquesManager({ typeFilter }: { typeFilter: IconiqueType }) {
  const [iconiques, setIconiques] = useState<Iconique[]>([])
  const [chineuses, setChineuses] = useState<{ trigramme: string; nom: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null) // null = list; 'new' = new; string = edit
  const [draft, setDraft] = useState<Iconique>(emptyDraft(typeFilter, 999))
  const [saving, setSaving] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // Charge la liste des chineuses (trigramme + nom) — utilisée pour le sélecteur
  // dans le formulaire d'iconique. Pas de re-fetch (les chineuses changent rarement).
  useEffect(() => {
    getDocs(collection(db, 'chineuse'))
      .then(snap => {
        const list = snap.docs
          .map(d => ({
            trigramme: (d.data() as any).trigramme?.toUpperCase() || '',
            nom: (d.data() as any).nom || '',
          }))
          .filter(c => !!c.trigramme)
          .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
        setChineuses(list)
      })
      .catch(err => console.error('loadChineuses error:', err))
  }, [])

  const loadIconiques = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'iconiques'), where('type', '==', typeFilter)))
      const list: Iconique[] = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any), type: (d.data() as any).type || 'vintage' }))
        .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
      setIconiques(list)
    } catch (err) {
      console.error('loadIconiques error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setEditingId(null)
    loadIconiques()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter])

  // Swap l'ordre d'un iconique avec son voisin (direction -1 = up, +1 = down).
  // Écrit les deux docs Firestore + met à jour l'état local (re-tri par ordre).
  const moveIconique = async (icon: Iconique, direction: -1 | 1) => {
    const currentIdx = iconiques.findIndex(i => i.id === icon.id)
    const swapIdx = currentIdx + direction
    if (swapIdx < 0 || swapIdx >= iconiques.length) return
    const other = iconiques[swapIdx]
    const currentOrdre = icon.ordre ?? currentIdx + 1
    const otherOrdre = other.ordre ?? swapIdx + 1
    // Si les 2 ordres sont identiques (ex : legacy à 0), on force une différence
    // pour que le swap ait un effet.
    const newCurrentOrdre = currentOrdre === otherOrdre ? swapIdx + 1 : otherOrdre
    const newOtherOrdre = currentOrdre === otherOrdre ? currentIdx + 1 : currentOrdre
    try {
      await Promise.all([
        setDoc(doc(db, 'iconiques', icon.id), { ordre: newCurrentOrdre }, { merge: true }),
        setDoc(doc(db, 'iconiques', other.id), { ordre: newOtherOrdre }, { merge: true }),
      ])
      setIconiques(prev => prev
        .map(i => i.id === icon.id ? { ...i, ordre: newCurrentOrdre } : i.id === other.id ? { ...i, ordre: newOtherOrdre } : i)
        .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
      )
    } catch (err) {
      console.error('moveIconique error:', err)
      alert('Erreur : déplacement impossible')
    }
  }

  const toggleDisplay = async (icon: Iconique) => {
    const next = !(icon.displayOnWebsite !== false)
    try {
      await setDoc(doc(db, 'iconiques', icon.id), { displayOnWebsite: next }, { merge: true })
      setIconiques(prev => prev.map(i => i.id === icon.id ? { ...i, displayOnWebsite: next } : i))
    } catch (err) {
      console.error('toggleDisplay error:', err)
      alert('Erreur : sauvegarde impossible')
    }
  }

  const openNew = () => {
    setDraft(emptyDraft(typeFilter, (iconiques[iconiques.length - 1]?.ordre || 0) + 1))
    setEditingId('new')
  }

  const openEdit = (icon: Iconique) => {
    setDraft({ ...emptyDraft(typeFilter, icon.ordre || 0), ...icon })
    setEditingId(icon.id)
  }

  const backToList = () => setEditingId(null)

  const uploadFile = async (file: File, kind: 'image' | 'video') => {
    setUploadingCount(c => c + 1)
    try {
      if (kind === 'image') {
        const base64 = await compressImage(file)
        const res = await fetch('/api/detourage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, uploadOnly: true, skipDetourage: true }),
        })
        const data = await res.json()
        if (!data.success || !data.maskUrl) throw new Error(data.error || 'upload failed')
        setDraft(prev => ({ ...prev, images: [...(prev.images || []), data.maskUrl] }))
      } else {
        // Vidéo : upload brut sur Bunny via une API dédiée ? Pour l'instant fallback : URL manuelle.
        alert('Upload vidéo pas encore branché — colle une URL dans le champ.')
      }
    } catch (err: any) {
      console.error('upload error:', err)
      alert('Erreur upload : ' + (err?.message || ''))
    } finally {
      setUploadingCount(c => c - 1)
    }
  }

  const handleImagesPicked = async (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      await uploadFile(f, 'image')
    }
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const removeImage = (url: string) => {
    setDraft(prev => ({ ...prev, images: (prev.images || []).filter(x => x !== url) }))
  }

  const moveImage = (idx: number, dir: 'left' | 'right') => {
    setDraft(prev => {
      const arr = [...(prev.images || [])]
      const target = dir === 'left' ? idx - 1 : idx + 1
      if (target < 0 || target >= arr.length) return prev
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return { ...prev, images: arr }
    })
  }

  const addVideoUrl = () => {
    const url = window.prompt('URL de la vidéo (mp4 ou embed)')?.trim()
    if (!url) return
    setDraft(prev => ({ ...prev, videos: [...(prev.videos || []), url] }))
  }

  const removeVideo = (url: string) => {
    setDraft(prev => ({ ...prev, videos: (prev.videos || []).filter(x => x !== url) }))
  }

  const handleSave = async () => {
    if (!draft.nom?.trim()) {
      alert('Le nom est requis')
      return
    }
    setSaving(true)
    try {
      const isNew = editingId === 'new'
      const docId = isNew ? (draft.slug?.trim() || slugify(draft.nom)) : draft.id
      if (!docId) {
        alert('Impossible de déterminer le slug')
        setSaving(false)
        return
      }
      const payload: any = {
        ...draft,
        slug: draft.slug?.trim() || docId,
        type: typeFilter,
        chineuseTrigrammes: (draft.chineuseTrigrammes || []).map(t => t.toUpperCase().trim()).filter(Boolean),
        categoriesIn: (draft.categoriesIn || []).map(c => c.toLowerCase().trim()).filter(Boolean),
        marquesIn: (draft.marquesIn || []).map(m => m.trim()).filter(Boolean),
        valeurNeuf: Number(draft.valeurNeuf) || 0,
        valeurNeufMax: draft.valeurNeufMax && Number(draft.valeurNeufMax) > 0 ? Number(draft.valeurNeufMax) : null,
        ordre: Number(draft.ordre) || 0,
        displayOnWebsite: draft.displayOnWebsite !== false,
        soldOut: !!draft.soldOut,
        updatedAt: new Date(),
      }
      delete payload.id
      await setDoc(doc(db, 'iconiques', docId), payload, { merge: true })
      alert('✅ Sauvegardé')
      await loadIconiques()
      setEditingId(null)
    } catch (err: any) {
      console.error('save error:', err)
      alert('❌ Erreur sauvegarde : ' + (err?.message || ''))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (editingId === 'new' || !draft.id) return
    if (!window.confirm(`Supprimer définitivement "${draft.nom}" ?`)) return
    try {
      await deleteDoc(doc(db, 'iconiques', draft.id))
      await loadIconiques()
      setEditingId(null)
    } catch (err: any) {
      console.error('delete error:', err)
      alert('Erreur suppression : ' + (err?.message || ''))
    }
  }

  // ================= LIST VIEW =================
  if (editingId === null) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {iconiques.length} iconique{iconiques.length > 1 ? 's' : ''} {typeFilter}
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-[#22209C] text-white px-4 py-2 rounded hover:bg-[#1a1878]"
          >
            <Plus size={16} /> Nouvel iconique
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-500">Chargement...</div>
        ) : iconiques.length === 0 ? (
          <div className="py-10 text-center text-gray-500 border rounded-lg bg-white">
            Aucun iconique — clique sur "Nouvel iconique" pour en créer un.
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 w-16">Ordre</th>
                  <th className="text-left px-3 py-2 w-20">Photo</th>
                  <th className="text-left px-3 py-2">Nom</th>
                  <th className="text-left px-3 py-2">Règles</th>
                  <th className="text-center px-3 py-2 w-24">Affiché</th>
                  <th className="text-right px-3 py-2 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {iconiques.map((icon, idx) => {
                  const displayed = icon.displayOnWebsite !== false
                  const preview = icon.images?.[0] || ''
                  const rules: string[] = []
                  if (icon.marque) rules.push(`marque=${icon.marque}`)
                  if (icon.marquesIn && icon.marquesIn.length > 0) rules.push(`marques=${icon.marquesIn.join('/')}`)
                  if (icon.chineuseTrigrammes && icon.chineuseTrigrammes.length > 0) rules.push(`tri=${icon.chineuseTrigrammes.join(',')}`)
                  if (icon.categoriesIn && icon.categoriesIn.length > 0) rules.push(`cat=${icon.categoriesIn.join(',')}`)
                  if (icon.categorieRecherche) rules.push(`rech=${icon.categorieRecherche}`)
                  const isFirst = idx === 0
                  const isLast = idx === iconiques.length - 1
                  return (
                    <tr key={icon.id} className={`border-b hover:bg-gray-50 ${!displayed ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <span className="w-6 text-right">{icon.ordre ?? '?'}</span>
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveIconique(icon, -1)}
                              disabled={isFirst}
                              title="Monter"
                              className={`p-0.5 ${isFirst ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-black hover:bg-gray-100 rounded'}`}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => moveIconique(icon, 1)}
                              disabled={isLast}
                              title="Descendre"
                              className={`p-0.5 ${isLast ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-black hover:bg-gray-100 rounded'}`}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={preview} alt="" className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                            <ImagePlus size={16} />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{icon.nom || '(sans nom)'}</div>
                        <div className="text-xs text-gray-500">{icon.slug || icon.id}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {rules.length > 0 ? rules.join(' · ') : <span className="text-red-500">aucune</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => toggleDisplay(icon)}
                          title={displayed ? 'Masquer du site' : 'Afficher sur le site'}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded ${displayed ? 'text-green-700 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                          {displayed ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => openEdit(icon)}
                          className="text-[#22209C] hover:underline text-sm"
                        >
                          Éditer
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ================= EDIT VIEW =================
  const inputCls = 'border rounded px-3 py-2 w-full text-sm'
  const textareaCls = 'border rounded px-3 py-2 w-full text-sm min-h-[120px]'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={backToList} className="flex items-center gap-2 text-sm text-gray-600 hover:text-black">
          <ArrowLeft size={16} /> Retour à la liste
        </button>
        <div className="flex items-center gap-2">
          {editingId !== 'new' && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded text-sm"
            >
              <Trash2 size={16} /> Supprimer
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || uploadingCount > 0}
            className="flex items-center gap-2 bg-[#22209C] text-white px-4 py-2 rounded hover:bg-[#1a1878] disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6 space-y-6">
        {/* Statut */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.displayOnWebsite !== false}
              onChange={e => setDraft({ ...draft, displayOnWebsite: e.target.checked })}
            />
            Afficher sur le site
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!draft.soldOut}
              onChange={e => setDraft({ ...draft, soldOut: e.target.checked })}
            />
            Marquer comme sold out
          </label>
        </div>

        {/* Textes principaux */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom (FR)">
            <input className={inputCls} value={draft.nom || ''} onChange={e => setDraft({ ...draft, nom: e.target.value })} />
          </Field>
          <Field label="Nom (EN)">
            <input className={inputCls} value={draft.nomEn || ''} onChange={e => setDraft({ ...draft, nomEn: e.target.value })} />
          </Field>
          <Field label="Nom pluriel (FR)">
            <input className={inputCls} value={draft.nomPluriel || ''} onChange={e => setDraft({ ...draft, nomPluriel: e.target.value })} />
          </Field>
          <Field label="Nom pluriel (EN)">
            <input className={inputCls} value={draft.nomPlurielEn || ''} onChange={e => setDraft({ ...draft, nomPlurielEn: e.target.value })} />
          </Field>
          <Field label="Slug (URL)">
            <input
              className={inputCls}
              value={draft.slug || ''}
              onChange={e => setDraft({ ...draft, slug: e.target.value })}
              placeholder={editingId === 'new' ? slugify(draft.nom || '') : ''}
              disabled={editingId !== 'new'}
            />
          </Field>
          <Field label="Date de création (année ou période)">
            <input className={inputCls} value={draft.dateCreation || ''} onChange={e => setDraft({ ...draft, dateCreation: e.target.value })} placeholder="1954" />
          </Field>
          <Field label="Valeur neuf (€) — min / max (optionnel)">
            <div className="flex items-center gap-2">
              <input
                className={inputCls}
                type="number"
                placeholder="min"
                value={draft.valeurNeuf ?? ''}
                onChange={e => setDraft({ ...draft, valeurNeuf: e.target.value === '' ? 0 : Number(e.target.value) })}
              />
              <span className="text-gray-400">/</span>
              <input
                className={inputCls}
                type="number"
                placeholder="max (facultatif)"
                value={draft.valeurNeufMax ?? ''}
                onChange={e => setDraft({ ...draft, valeurNeufMax: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
          </Field>
          <Field label="Tendance prix">
            <select
              className={inputCls}
              value={draft.tendancePrix || 'stable'}
              onChange={e => setDraft({ ...draft, tendancePrix: e.target.value as any })}
            >
              <option value="monte">Monte</option>
              <option value="stable">Stable</option>
              <option value="baisse">Baisse</option>
            </select>
          </Field>
          <Field label="Buy link (facultatif)">
            <input className={inputCls} value={draft.buyLink || ''} onChange={e => setDraft({ ...draft, buyLink: e.target.value })} placeholder="https://…" />
          </Field>
        </div>

        <Field label="Histoire (FR)">
          <textarea className={textareaCls} value={draft.histoire || ''} onChange={e => setDraft({ ...draft, histoire: e.target.value })} />
        </Field>
        <Field label="Histoire (EN)">
          <textarea className={textareaCls} value={draft.histoireEn || ''} onChange={e => setDraft({ ...draft, histoireEn: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Pourquoi c'est must (FR)">
            <input className={inputCls} value={draft.pourquoiMust || ''} onChange={e => setDraft({ ...draft, pourquoiMust: e.target.value })} />
          </Field>
          <Field label="Pourquoi c'est must (EN)">
            <input className={inputCls} value={draft.pourquoiMustEn || ''} onChange={e => setDraft({ ...draft, pourquoiMustEn: e.target.value })} />
          </Field>
        </div>

        {/* Règles de matching */}
        <div className="pt-6 border-t">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Règles de sélection des produits</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Marque (ex: Chanel, Hermès, Burberry, luxe)">
              <input className={inputCls} value={draft.marque || ''} onChange={e => setDraft({ ...draft, marque: e.target.value })} />
            </Field>
            <Field label="Ou plusieurs marques (séparées par virgule)">
              <input
                className={inputCls}
                value={(draft.marquesIn || []).join(', ')}
                onChange={e => setDraft({ ...draft, marquesIn: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
                placeholder="YSL, Ralph Lauren, Lacoste…"
              />
            </Field>
            <Field label="Catégorie de recherche (mot-clé dans nom/catégorie)">
              <input className={inputCls} value={draft.categorieRecherche || ''} onChange={e => setDraft({ ...draft, categorieRecherche: e.target.value })} placeholder="tweed, carré, foulard…" />
            </Field>
            <Field label="Chineuses (coche celles à inclure)">
              <div className="border rounded p-2 max-h-48 overflow-y-auto bg-white">
                {chineuses.length === 0 ? (
                  <div className="text-xs text-gray-500 py-2 text-center">Chargement...</div>
                ) : (
                  chineuses.map(c => {
                    const checked = (draft.chineuseTrigrammes || []).includes(c.trigramme)
                    return (
                      <label key={c.trigramme} className="flex items-center gap-2 py-1 px-1 hover:bg-gray-50 rounded cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            const set = new Set(draft.chineuseTrigrammes || [])
                            if (e.target.checked) set.add(c.trigramme)
                            else set.delete(c.trigramme)
                            setDraft({ ...draft, chineuseTrigrammes: Array.from(set) })
                          }}
                        />
                        <span className="font-mono text-xs text-gray-500 w-12">{c.trigramme}</span>
                        <span>{c.nom || <span className="italic text-gray-400">(sans nom)</span>}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </Field>
            <Field label="Catégories in (séparées par virgule)">
              <input
                className={inputCls}
                value={(draft.categoriesIn || []).join(', ')}
                onChange={e => setDraft({ ...draft, categoriesIn: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
                placeholder="veste, manteau"
              />
            </Field>
            <Field label="Matière contient">
              <input className={inputCls} value={draft.materialContient || ''} onChange={e => setDraft({ ...draft, materialContient: e.target.value })} placeholder="cuir, soie…" />
            </Field>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Au moins une règle (marque, trigrammes ou catégories) est fortement recommandée pour éviter de charger tous les produits du site.
          </p>
        </div>

        {/* Photos */}
        <div className="pt-6 border-t">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Photos ({(draft.images || []).length})</h3>
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingCount > 0}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded text-sm disabled:opacity-50"
            >
              <ImagePlus size={16} /> Ajouter des photos
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleImagesPicked(e.target.files)}
            />
          </div>
          {uploadingCount > 0 && (
            <div className="text-sm text-gray-500 mb-2">📤 Upload en cours…</div>
          )}
          {(draft.images || []).length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400 border border-dashed rounded">Aucune photo.</div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {(draft.images || []).map((url, idx) => (
                <div key={url + idx} className="relative group border rounded overflow-hidden bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full aspect-square object-cover" />
                  <button
                    onClick={() => removeImage(url)}
                    className="absolute top-1 right-1 bg-white/90 hover:bg-white p-1 rounded-full shadow"
                    title="Supprimer"
                  >
                    <X size={14} />
                  </button>
                  <div className="absolute bottom-1 left-1 right-1 flex justify-between gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => moveImage(idx, 'left')}
                      className="bg-white/90 hover:bg-white text-xs px-1.5 py-0.5 rounded"
                      disabled={idx === 0}
                    >
                      ←
                    </button>
                    <button
                      onClick={() => moveImage(idx, 'right')}
                      className="bg-white/90 hover:bg-white text-xs px-1.5 py-0.5 rounded"
                      disabled={idx === (draft.images || []).length - 1}
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vidéos */}
        <div className="pt-6 border-t">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Vidéos ({(draft.videos || []).length})</h3>
            <button
              onClick={addVideoUrl}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded text-sm"
            >
              <Film size={16} /> Ajouter une URL vidéo
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <Field label="Label vidéos (FR)">
              <input className={inputCls} value={draft.videosLabel || ''} onChange={e => setDraft({ ...draft, videosLabel: e.target.value })} placeholder="ex: Sur nos clientes" />
            </Field>
            <Field label="Label vidéos (EN)">
              <input className={inputCls} value={draft.videosLabelEn || ''} onChange={e => setDraft({ ...draft, videosLabelEn: e.target.value })} placeholder="ex: On our clients" />
            </Field>
          </div>
          {(draft.videos || []).length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-400 border border-dashed rounded">Aucune vidéo.</div>
          ) : (
            <ul className="space-y-1">
              {(draft.videos || []).map((url) => (
                <li key={url} className="flex items-center justify-between gap-2 bg-gray-50 border rounded px-3 py-2 text-sm">
                  <span className="truncate flex-1 text-gray-700">{url}</span>
                  <button onClick={() => removeVideo(url)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
