'use client'

// /admin/marges — saisie des prix d'achat oubliés sur les pièces maison DÉJÀ
// VENDUES. Ces pièces ne sont plus listées dans /admin/nos-produits (elles
// disparaissent à la vente), donc c'est le seul endroit pour corriger leur
// `prixAchat` — sans lui, la vente compte 0 € de marge dans le dashboard.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { auth } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { formatPrix } from '@/lib/formatPrix'
import { margeTtcVersHt } from '@/lib/marge'
import { Check, RefreshCw, AlertTriangle } from 'lucide-react'

type Ligne = {
  produitId: string
  sku: string
  nom: string
  marque?: string | null
  trigramme: string
  image?: string | null
  ventes: number
  ca: number
  derniereVente: string | null
}

type Stats = {
  totalVentes: number
  completes: number
  aCompleter: number
  produits: number
  caACompleter: number
  ventesSansProduit: number
}

export default function MargesAComplererPage() {
  const annees = [new Date().getFullYear(), new Date().getFullYear() - 1]
  const [annee, setAnnee] = useState(annees[0])
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [saisies, setSaisies] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [pret, setPret] = useState(false)

  useEffect(() => onAuthStateChanged(auth, u => setPret(!!u)), [])

  const charger = useCallback(async () => {
    setLoading(true)
    setErreur(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`/api/admin/marges-manquantes?annee=${annee}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: 'no-store',
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'erreur')
      setLignes(data.lignes)
      setStats(data.stats)
      setSaisies({})
    } catch (e: any) {
      setErreur(e?.message || 'erreur de chargement')
    }
    setLoading(false)
  }, [annee])

  useEffect(() => { if (pret) charger() }, [pret, charger])

  // Marge HT qu'ajouterait la saisie en cours : (CA − prixAchat × nb ventes) ÷ 1,20
  const margeLigne = (l: Ligne) => {
    const pa = parseFloat(saisies[l.produitId] || '')
    if (!Number.isFinite(pa) || pa <= 0) return null
    return Math.round(margeTtcVersHt(l.ca - pa * l.ventes))
  }

  const aEnregistrer = useMemo(
    () => lignes.filter(l => {
      const pa = parseFloat(saisies[l.produitId] || '')
      return Number.isFinite(pa) && pa > 0
    }),
    [lignes, saisies],
  )
  const margeAjoutee = aEnregistrer.reduce((s, l) => s + (margeLigne(l) || 0), 0)

  const enregistrer = async () => {
    if (!aEnregistrer.length) return
    setSaving(true)
    setErreur(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/admin/marges-manquantes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          maj: aEnregistrer.map(l => ({ produitId: l.produitId, prixAchat: parseFloat(saisies[l.produitId]) })),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'erreur')
      await charger()
    } catch (e: any) {
      setErreur(e?.message || "erreur à l'enregistrement")
    }
    setSaving(false)
  }

  return (
    <div className="p-4 max-w-5xl mx-auto pb-32">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Prix d&apos;achat manquants</h1>
          <p className="text-xs text-gray-500">
            Pièces maison (NR/ACH) vendues sans prix d&apos;achat : elles comptent 0 € de marge.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={annee}
            onChange={e => setAnnee(Number(e.target.value))}
            className="border rounded px-2 py-1.5 text-sm"
          >
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={charger} className="p-2 rounded border text-gray-500 hover:bg-gray-50" title="Recharger">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500">À compléter</div>
            <div className="text-xl font-bold text-gray-900">{stats.produits} <span className="text-xs font-normal text-gray-400">pièces</span></div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500">Ventes concernées</div>
            <div className="text-xl font-bold text-gray-900">{stats.aCompleter} <span className="text-xs font-normal text-gray-400">/ {stats.totalVentes}</span></div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500">CA sans marge</div>
            <div className="text-xl font-bold text-gray-900">{formatPrix(stats.caACompleter)} <span className="text-xs font-normal text-gray-400">€ TTC</span></div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500">Déjà renseignées</div>
            <div className="text-xl font-bold text-emerald-600">{stats.completes}</div>
          </div>
        </div>
      )}

      {stats && stats.ventesSansProduit > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {stats.ventesSansProduit} vente(s) sans fiche produit liée : impossible de leur rattacher un prix d&apos;achat ici.
        </div>
      )}

      {erreur && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-xs">{erreur}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
        </div>
      ) : lignes.length === 0 ? (
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100 text-center">
          <Check className="mx-auto mb-2 text-emerald-500" size={24} />
          <p className="text-sm text-gray-600">Tous les prix d&apos;achat {annee} sont renseignés.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-2 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Pièce</th>
                <th className="text-right py-2 px-2 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Vendu</th>
                <th className="text-left py-2 px-2 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Date</th>
                <th className="text-right py-2 px-2 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Prix d&apos;achat</th>
                <th className="text-right py-2 px-2 font-medium text-gray-400 uppercase" style={{ fontSize: '10px' }}>Marge HT</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(l => {
                const marge = margeLigne(l)
                return (
                  <tr key={l.produitId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        {l.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.image} alt="" className="w-9 h-9 object-cover rounded" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{l.sku}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[220px]">{l.nom}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      {formatPrix(Math.round(l.ca))} €
                      {l.ventes > 1 && <span className="text-xs text-gray-400"> ({l.ventes} ventes)</span>}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-500 whitespace-nowrap">{l.derniereVente || '-'}</td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={saisies[l.produitId] || ''}
                        onChange={e => setSaisies(s => ({ ...s, [l.produitId]: e.target.value }))}
                        placeholder="€"
                        className="w-24 border rounded px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      {marge === null
                        ? <span className="text-gray-300">—</span>
                        : <span className={marge < 0 ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>{formatPrix(marge)} €</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {aEnregistrer.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div className="text-xs text-gray-600">
              {aEnregistrer.length} pièce(s) saisie(s) · marge ajoutée{' '}
              <strong className={margeAjoutee < 0 ? 'text-red-600' : 'text-emerald-700'}>{formatPrix(margeAjoutee)} € HT</strong>
            </div>
            <button
              onClick={enregistrer}
              disabled={saving}
              className="bg-[#22209C] text-white text-sm font-medium rounded px-4 py-2 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
