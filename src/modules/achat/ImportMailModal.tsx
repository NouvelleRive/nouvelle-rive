// Modal d'import manuel d'un mail Vinted/transporteur depuis l'admin.
// Temporaire : à retirer en même temps que /api/achat/import-manual quand le
// webhook Pub/Sub Gmail aura validé la prise en charge du backlog.

'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { auth } from '@/lib/firebaseConfig'

type Props = { onClose: () => void }

export default function ImportMailModal({ onClose }: Props) {
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleImport = async () => {
    if (!body.trim()) {
      setResult({ ok: false, message: 'Colle d\'abord le contenu d\'un mail.' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const user = auth.currentUser
      if (!user) {
        setResult({ ok: false, message: 'Tu n\'es pas connectée.' })
        return
      }
      const idToken = await user.getIdToken()
      const res = await fetch('/api/achat/import-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ body }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) {
        setResult({ ok: false, message: json.reason || json.error || `Erreur ${res.status}` })
        return
      }
      const detail =
        json.kind === 'vinted-receipt' ? `Brouillon créé : ${json.sku}` :
        json.kind === 'vinted-page' || json.kind === 'vinted-page-no-itemid' ? `Brouillon créé depuis la page : ${json.sku}` :
        json.kind === 'tracking-set' ? `Suivi ${json.numeroSuivi} ajouté` :
        json.kind?.startsWith('mondial-relay') ? 'Livraison Mondial Relay enregistrée' :
        json.kind === 'chronopost-pickup' ? 'Livraison Chronopost Pickup enregistrée' :
        'OK'
      setResult({ ok: true, message: detail })
      setBody('')
    } catch (e: any) {
      setResult({ ok: false, message: e?.message || 'Erreur inattendue' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Importer depuis Vinted</h2>
            <p className="text-sm text-gray-500 mt-1">
              Colle ici n'importe lequel de ces 3 formats (cmd+A et cmd+C sur vinted, cmd+V ici) :
              <br />— la <strong>page de l'annonce Vinted</strong>
              <br />— le <strong>lien de l'annonce</strong> (ex: vinted.fr/items/123-xxx)
              <br />— le contenu d'un <strong>mail</strong> (Vinted "Ton reçu", Chronopost, Mondial Relay, Pickup)
              <br /><span className="italic">NB : La page donne plus d'infos (marque, taille, couleur, état, description) que le mail ou le lien seul. Les photos doivent être ajoutées à la main pour le moment.</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Colle ici le mail complet (texte ou HTML)…"
          className="flex-1 min-h-[260px] w-full border border-gray-300 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#09B1BA] resize-none"
        />

        {result && (
          <div
            className={`mt-3 px-3 py-2 rounded-lg text-sm ${
              result.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {result.ok ? '✓ ' : '✗ '}{result.message}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Fermer
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !body.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#09B1BA] hover:bg-[#078a91] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
          >
            {loading ? 'Import…' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  )
}
