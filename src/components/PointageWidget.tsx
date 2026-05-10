// Widget de pointage : s'affiche en haut des pages vendeuse
'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { Clock, MapPin, CheckCircle2 } from 'lucide-react'

type Vendeuse = { id: string; prenom?: string; nom?: string; actif?: boolean }
type Pointage = { vendeuseId: string; date: string; arrivee: string | null; depart: string | null }

const STORAGE_KEY = 'nouvelle-rive-vendeuse-id'
const BOUTIQUE_TOKEN_KEY = 'nr_boutique_token'

function fmt(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function durationStr(arrivee: string, depart: string | null): string {
  const start = new Date(arrivee).getTime()
  const end = depart ? new Date(depart).getTime() : Date.now()
  const ms = end - start
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h${String(m).padStart(2, '0')}`
}

export default function PointageWidget() {
  const [vendeuses, setVendeuses] = useState<Vendeuse[]>([])
  const [vendeuseId, setVendeuseId] = useState<string>('')
  const [pointage, setPointage] = useState<Pointage | null>(null)
  const [loading, setLoading] = useState(false)
  const [, setTick] = useState(0)

  // Tick pour rafraîchir la durée affichée
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  // Détecte ?setup=... dans l'URL → enregistre le device comme tel boutique
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const setup = params.get('setup')
    if (setup) {
      localStorage.setItem(BOUTIQUE_TOKEN_KEY, setup)
      params.delete('setup')
      const newSearch = params.toString()
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash
      window.history.replaceState({}, '', newUrl)
      alert('Ce téléphone est enregistré comme tel de la boutique.')
    }
  }, [])

  // Charger les vendeuses actives
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'vendeuses'))
      const list: Vendeuse[] = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(v => v.actif !== false)
      setVendeuses(list)
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (stored && list.find(v => v.id === stored)) setVendeuseId(stored)
    })()
  }, [])

  // Charger le pointage du jour quand on change de vendeuse
  useEffect(() => {
    if (!vendeuseId) { setPointage(null); return }
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, vendeuseId)
    fetchPointage()
  }, [vendeuseId])

  const fetchPointage = async () => {
    if (!vendeuseId) return
    try {
      const res = await fetch(`/api/pointage?vendeuseId=${vendeuseId}`)
      const data = await res.json()
      if (data.success) setPointage(data.pointage)
    } catch {}
  }

  const pointer = async (action: 'arrivee' | 'depart') => {
    if (!vendeuseId) return
    const boutiqueToken = typeof window !== 'undefined' ? localStorage.getItem(BOUTIQUE_TOKEN_KEY) : null
    if (!boutiqueToken) {
      alert('Tu dois pointer depuis le téléphone de la boutique 💙')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/pointage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendeuseId, action, boutiqueToken }),
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Erreur de pointage')
      } else {
        await fetchPointage()
        if (action === 'arrivee' && Array.isArray(data.missingDeparts) && data.missingDeparts.length > 0) {
          const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
          const lignes = data.missingDeparts.map((d: string) => {
            const [, mm, dd] = d.split('-')
            return `• ${parseInt(dd, 10)} ${monthNames[parseInt(mm, 10) - 1]}`
          }).join('\n')
          alert(
            `⏰ Tu as oublié de pointer ton départ :\n\n${lignes}\n\n` +
            `Envoie-nous ton heure de départ par message pour qu'on ferme ta journée 💙`
          )
        }
      }
    } catch (e: any) {
      alert(e?.message || 'Erreur de pointage. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Clock size={18} className="text-[#22209C]" />
          <select
            value={vendeuseId}
            onChange={(e) => setVendeuseId(e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-white"
          >
            <option value="">— Choisir —</option>
            {vendeuses.map(v => (
              <option key={v.id} value={v.id}>{v.prenom || v.nom || v.id}</option>
            ))}
          </select>
          {vendeuseId && pointage?.arrivee && (
            <span className="text-sm text-gray-700 ml-2">
              Arrivée <strong>{fmt(pointage.arrivee)}</strong>
              {pointage.depart
                ? <> · Départ <strong>{fmt(pointage.depart)}</strong> · <span className="text-green-700">{durationStr(pointage.arrivee, pointage.depart)}</span></>
                : <> · <span className="text-[#22209C]">{durationStr(pointage.arrivee, null)} en cours</span></>
              }
            </span>
          )}
          {vendeuseId && !pointage?.arrivee && (
            <span className="text-sm text-gray-500">Pas encore pointée</span>
          )}
        </div>

        {vendeuseId && (
          <div className="flex items-center gap-2">
            {!pointage?.arrivee && (
              <button
                disabled={loading}
                onClick={() => pointer('arrivee')}
                className="px-4 py-2 bg-[#22209C] text-white text-sm rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <MapPin size={14} />
                {loading ? '…' : 'J\'arrive'}
              </button>
            )}
            {pointage?.arrivee && !pointage?.depart && (
              <button
                disabled={loading}
                onClick={() => pointer('depart')}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <MapPin size={14} />
                {loading ? '…' : 'Je pars'}
              </button>
            )}
            {pointage?.arrivee && pointage?.depart && (
              <span className="px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-lg flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Journée terminée
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
