// app/acheteuse/strategie/page.tsx
// Stratégie d'achat : onglet Objectif (nb de pièces cible + règles %/critère) et
// onglet Réalisé (compteurs + jauges réel vs objectif + alertes restock).
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import { formatPrix } from '@/lib/formatPrix'
import { ADMIN_EMAIL, ACHETEUSE_EMAIL } from '@/lib/roles'
import { COLOR_PALETTE } from '@/lib/couleurs'
import { ALL_MODELES } from '@/lib/modeles'
import { ALL_TAILLES } from '@/lib/tailles'
import { MARQUES } from '@/lib/marques'
import { MOTIF_OPTIONS } from '@/lib/motifs'
import {
  AXIS_LABELS,
  OBJECTIF_VIDE,
  type AxisKey,
  type StrategieObjectif,
  type StrategieRule,
  type StrategieRealise,
} from '@/modules/achat-strategie/types'

const AXES = Object.keys(AXIS_LABELS) as AxisKey[]

// Catégories courantes (sous-chaînes qui matchent les libellés Square, ex:
// "Veste" ⊂ "NR - Veste / Manteau"). matchRule est en sous-chaîne.
const CATEGORIE_OPTIONS = [
  'Veste', 'Manteau', 'Blazer', 'Robe', 'Jupe', 'Pantalon', 'Jean', 'Short',
  'Top', 'Chemise', 'Blouse', 'Pull', 'Gilet', 'Combinaison', 'Maillot',
  'Sac', 'Ceinture', 'Foulard', 'Écharpe', 'Chapeau',
  'Chaussures', 'Bottes', 'Baskets', 'Sandales',
  'Collier', 'Bague', 'Bracelet', "Boucles d'oreilles", 'Broche',
]

// Options de valeur par axe. Absent → saisie libre ; 'prix' → fourchette min-max.
const OPTIONS_BY_AXIS: Partial<Record<AxisKey, string[]>> = {
  color: COLOR_PALETTE.map(c => c.name),
  modele: ALL_MODELES,
  motif: MOTIF_OPTIONS,
  taille: ALL_TAILLES,
  marque: MARQUES,
  categorie: CATEGORIE_OPTIONS,
}

function newRule(): StrategieRule {
  return { id: `r_${Math.round(performance.now())}_${Math.floor(performance.now() % 1000)}`, label: '', axis: 'color', match: '', targetPct: 10 }
}

// Multi-sélection (cases à cocher) — valeurs jointes par virgule (logique OU).
function MultiSelect({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []
  return (
    <div className="relative">
      <div
        className="w-full border rounded px-2 py-1.5 text-sm bg-white cursor-pointer flex items-center justify-between min-h-[34px]"
        onClick={() => setOpen(!open)}
      >
        <span className={`truncate ${selected.length ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected.length ? selected.join(', ') : '— Choisir —'}
        </span>
        <span className="text-gray-400 shrink-0 ml-1">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {options.map(opt => {
            const isSel = selected.includes(opt)
            return (
              <label key={opt} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => {
                    const updated = isSel ? selected.filter(x => x !== opt) : [...selected, opt]
                    onChange(updated.join(', '))
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-[#22209C] focus:ring-[#22209C]"
                />
                <span>{opt}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function StrategieAchatPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<'objectif' | 'realise'>('realise')
  const [objectif, setObjectif] = useState<StrategieObjectif>(OBJECTIF_VIDE)
  const [realise, setRealise] = useState<StrategieRealise | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async (u: User, refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true)
    try {
      const token = await u.getIdToken()
      const url = refresh ? '/api/acheteuse/strategie?refresh=1' : '/api/acheteuse/strategie'
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        setObjectif(data.objectif || OBJECTIF_VIDE)
        setRealise(data.realise || null)
      }
    } catch (e) {
      console.error('Erreur chargement stratégie', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const handleRefresh = () => {
    const u = auth.currentUser
    if (u) load(u, true)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push('/login'); return }
      if (u.email !== ACHETEUSE_EMAIL && u.email !== ADMIN_EMAIL) { router.push('/app'); return }
      setReady(true)
      load(u)
    })
    return () => unsub()
  }, [router, load])

  const save = async () => {
    const u = auth.currentUser
    if (!u) return
    setSaving(true)
    setMsg(null)
    try {
      const token = await u.getIdToken()
      const res = await fetch('/api/acheteuse/strategie', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ objectif }),
      })
      const data = await res.json()
      if (data.success) {
        setObjectif(data.objectif)
        setRealise(data.realise)
        setMsg('✅ Objectif enregistré')
        setTab('realise')
      } else {
        setMsg(`✗ ${data.error || 'Erreur'}`)
      }
    } catch (e: any) {
      setMsg(`✗ ${e?.message || 'Erreur'}`)
    } finally {
      setSaving(false)
    }
  }

  const updateRule = (id: string, patch: Partial<StrategieRule>) =>
    setObjectif(o => ({ ...o, rules: o.rules.map(r => r.id === id ? { ...r, ...patch } : r) }))
  const removeRule = (id: string) =>
    setObjectif(o => ({ ...o, rules: o.rules.filter(r => r.id !== id) }))
  const addRule = () =>
    setObjectif(o => ({ ...o, rules: [...o.rules, newRule()] }))

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-[#22209C] mb-1">STRATÉGIE D'ACHAT</h1>
      <p className="text-sm text-gray-500 mb-4">Définis ton assortiment cible, suis ton réalisé.</p>

      {/* Onglets + actualiser */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(['realise', 'objectif'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                tab === t ? 'bg-white text-[#22209C] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'realise' ? 'Réalisé' : 'Objectif'}
            </button>
          ))}
        </div>
        {tab === 'realise' && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Recalcule le réalisé avec les pièces à jour (à cliquer après avoir tagué des modèles/tailles)"
            className="flex items-center gap-1.5 text-sm text-[#22209C] border border-[#22209C]/30 rounded-lg px-3 py-1.5 hover:bg-[#22209C]/5 disabled:opacity-50"
          >
            <span className={refreshing ? 'inline-block animate-spin' : ''}>↻</span>
            {refreshing ? 'Actualisation…' : 'Actualiser'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
        </div>
      ) : tab === 'objectif' ? (
        <ObjectifTab
          objectif={objectif}
          setCible={(n) => setObjectif(o => ({ ...o, cibleStock: n }))}
          updateRule={updateRule}
          removeRule={removeRule}
          addRule={addRule}
          save={save}
          saving={saving}
          msg={msg}
        />
      ) : (
        <RealiseTab realise={realise} />
      )}
    </div>
  )
}

// ============================================================
// Onglet OBJECTIF
// ============================================================
function ObjectifTab({
  objectif, setCible, updateRule, removeRule, addRule, save, saving, msg,
}: {
  objectif: StrategieObjectif
  setCible: (n: number) => void
  updateRule: (id: string, patch: Partial<StrategieRule>) => void
  removeRule: (id: string) => void
  addRule: () => void
  save: () => void
  saving: boolean
  msg: string | null
}) {
  return (
    <div className="space-y-5">
      <div className="bg-white border rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de pièces cible</label>
        <input
          type="number" min="0"
          value={objectif.cibleStock || ''}
          onChange={(e) => setCible(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-40 border rounded px-3 py-2 text-sm"
          placeholder="ex: 200"
        />
        <p className="text-xs text-gray-400 mt-1">Base de calcul des pourcentages ci-dessous.</p>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Règles d'assortiment</h2>

        {objectif.rules.length === 0 && (
          <p className="text-sm text-gray-400 py-2">Aucune règle. Ajoutes-en une (ex: 50 % de pièces noires).</p>
        )}

        {objectif.rules.map((r) => (
          <div key={r.id} className="grid grid-cols-12 gap-2 items-center border-t pt-3">
            <input
              className="col-span-12 sm:col-span-3 border rounded px-2 py-1.5 text-sm"
              placeholder="Libellé (ex: Vestes courtes)"
              value={r.label}
              onChange={(e) => updateRule(r.id, { label: e.target.value })}
            />
            <select
              className="col-span-5 sm:col-span-3 border rounded px-2 py-1.5 text-sm"
              value={r.axis}
              onChange={(e) => updateRule(r.id, { axis: e.target.value as AxisKey, match: '' })}
            >
              {AXES.map(a => <option key={a} value={a}>{AXIS_LABELS[a]}</option>)}
            </select>
            {OPTIONS_BY_AXIS[r.axis] ? (
              <div className="col-span-4 sm:col-span-3">
                <MultiSelect
                  options={OPTIONS_BY_AXIS[r.axis]!}
                  value={r.match}
                  onChange={(v) => updateRule(r.id, { match: v })}
                />
              </div>
            ) : (
              <input
                className="col-span-4 sm:col-span-3 border rounded px-2 py-1.5 text-sm"
                placeholder={r.axis === 'prix' ? 'ex: 0-50' : 'ex: zip'}
                value={r.match}
                onChange={(e) => updateRule(r.id, { match: e.target.value })}
              />
            )}
            <div className="col-span-2 sm:col-span-2 flex items-center gap-1">
              <input
                type="number" min="0" max="100"
                className="w-full border rounded px-2 py-1.5 text-sm"
                value={r.targetPct}
                onChange={(e) => updateRule(r.id, { targetPct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
            <button
              onClick={() => removeRule(r.id)}
              className="col-span-1 text-gray-400 hover:text-red-500 text-lg leading-none"
              title="Supprimer"
            >×</button>
          </div>
        ))}

        <button onClick={addRule} className="text-sm text-[#22209C] hover:underline mt-1">+ Ajouter une règle</button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 text-sm font-medium text-white bg-[#22209C] hover:bg-[#1a1875] disabled:opacity-50 rounded-lg"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer l\'objectif'}
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </div>
  )
}

// ============================================================
// Onglet RÉALISÉ
// ============================================================
function RealiseTab({ realise }: { realise: StrategieRealise | null }) {
  if (!realise) {
    return <p className="text-sm text-gray-400">Pas encore de données.</p>
  }
  return (
    <div className="space-y-5">
      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-3">
        <Counter label="Pièces cible" value={realise.cible} color="text-[#22209C]" />
        <Counter label="Commandées" value={realise.commandees} color="text-emerald-600" />
        <Counter label="En surface" value={realise.enSurface} color="text-[#09B1BA]" />
      </div>

      {/* Alertes restock */}
      {realise.aRestocker.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-amber-900 mb-2">🔔 À restocker</h2>
          <ul className="space-y-1">
            {realise.aRestocker.map(r => (
              <li key={r.id} className="text-sm text-amber-800">
                <span className="font-medium">{r.label}</span> — il manque <strong>{r.manque}</strong> pièce{r.manque > 1 ? 's' : ''} ({r.actualPct}% / {r.targetPct}%)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Jauges */}
      <div className="bg-white border rounded-lg p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Assortiment vs objectif</h2>
        {realise.rules.length === 0 && (
          <p className="text-sm text-gray-400">Aucune règle définie. Va dans l'onglet Objectif.</p>
        )}
        {realise.rules.map(r => (
          <div key={r.id}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-800">{r.label}</span>
              <span className={r.underTarget ? 'text-amber-600' : 'text-emerald-600'}>
                {r.actualPct}% <span className="text-gray-400">/ {r.targetPct}%</span>
                <span className="text-gray-400"> · {r.count} pc</span>
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${r.underTarget ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${Math.round(r.fill * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border rounded-lg p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}
