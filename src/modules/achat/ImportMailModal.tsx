// Modal d'import achat en 2 étapes :
//   1. Tu colles → "Vérifier"  → appel /api/achat/preview-import (parse + ortho Claude)
//   2. Aperçu éditable des champs + saisie obligatoire du prix de vente → "Créer"
//      → appel /api/achat/import-manual avec les fields validés
//
// Multi-items (Whatnot peut contenir N commandes) : on affiche N cartes dans
// l'aperçu, chaque carte a son propre prix de vente.
//
// Outil temporaire — à retirer en même temps que les routes import quand le
// webhook Pub/Sub Gmail prend le relais.

'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { auth } from '@/lib/firebaseConfig'

type Props = {
  onClose: () => void
  targetChineuse?: { uid: string; email: string; trigramme: string }
}

type ItemFields = {
  provenance: 'vinted' | 'whatnot'
  itemId?: string | null
  achatOrderId?: string | null
  titre: string
  titreOriginal?: string
  marque: string
  taille: string
  tailleOriginale?: string
  couleur: string
  etat: string
  description: string
  descriptionOriginale?: string
  vendeur: string
  prixAchat: number | null
  prixSuggere: number | null
  categorie: { label?: string; idsquare?: string } | null
  prixVente: string // saisi par l'admin, requis
}

type Step = 'paste' | 'preview' | 'creating' | 'done'

export default function ImportMailModal({ onClose, targetChineuse }: Props) {
  const [step, setStep] = useState<Step>('paste')
  const [pasted, setPasted] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [items, setItems] = useState<ItemFields[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const updateItem = (i: number, patch: Partial<ItemFields>) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  const handleVerify = async () => {
    if (!pasted.trim()) {
      setErrorMsg('Colle un contenu d\'abord.')
      return
    }
    setVerifying(true)
    setErrorMsg(null)
    try {
      const user = auth.currentUser
      if (!user) {
        setErrorMsg('Tu n\'es pas connectée.')
        return
      }
      const idToken = await user.getIdToken()
      const res = await fetch('/api/achat/preview-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ body: pasted, targetChineuse: targetChineuse || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) {
        setErrorMsg(json.reason || json.error || `Erreur ${res.status}`)
        return
      }
      // Normaliser en tableau d'items
      const raw: ItemFields[] = json.kind === 'whatnot-purchase'
        ? json.items.map((it: any) => ({ ...it, prixVente: it.prixSuggere ? String(it.prixSuggere) : '' }))
        : [{ ...json.fields, prixVente: json.fields.prixSuggere ? String(json.fields.prixSuggere) : '' }]
      setItems(raw)
      setStep('preview')
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erreur inattendue')
    } finally {
      setVerifying(false)
    }
  }

  const handleCreate = async () => {
    // validation : prix de vente requis pour chaque item
    for (let i = 0; i < items.length; i++) {
      const pv = parseFloat(items[i].prixVente || '')
      if (!Number.isFinite(pv) || pv <= 0) {
        setErrorMsg(`Item ${i + 1} : prix de vente manquant ou invalide.`)
        return
      }
    }
    setStep('creating')
    setErrorMsg(null)
    try {
      const user = auth.currentUser
      if (!user) {
        setErrorMsg('Tu n\'es pas connectée.')
        setStep('preview')
        return
      }
      const idToken = await user.getIdToken()
      const res = await fetch('/api/achat/import-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          validatedItems: items,
          targetChineuse: targetChineuse || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) {
        setErrorMsg(json.reason || json.error || `Erreur ${res.status}`)
        setStep('preview')
        return
      }
      setResultMsg(`✓ ${items.length} pièce(s) créée(s)`)
      setStep('done')
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erreur inattendue')
      setStep('preview')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {step === 'preview' ? 'Vérifie avant création' : 'Importer depuis Vinted / Whatnot'}
            </h2>
            {step === 'paste' && (
              <p className="text-sm text-gray-500 mt-1">
                Colle ici la page complète ou le mail (cmd+A, cmd+C, cmd+V).
              </p>
            )}
            {step === 'preview' && (
              <p className="text-sm text-gray-500 mt-1">
                Corrige si besoin et saisis le prix de vente, puis valide.
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {step === 'paste' && (
          <>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Colle ici le mail ou la page Vinted/Whatnot…"
              className="flex-1 min-h-[280px] w-full border border-gray-300 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#09B1BA] resize-none"
            />
            {errorMsg && (
              <div className="mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                ✗ {errorMsg}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Fermer</button>
              <button
                onClick={handleVerify}
                disabled={verifying || !pasted.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#09B1BA] hover:bg-[#078a91] disabled:opacity-50 rounded-lg"
              >
                {verifying ? 'Vérification…' : 'Vérifier'}
              </button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-4">
              {items.map((it, i) => (
                <div key={i} className="border rounded-xl p-4 bg-gray-50">
                  {items.length > 1 && (
                    <div className="text-xs font-semibold text-[#09B1BA] mb-2">Pièce {i + 1}/{items.length}</div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Titre</label>
                      <input value={it.titre} onChange={(e) => updateItem(i, { titre: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Marque</label>
                      <input value={it.marque} onChange={(e) => updateItem(i, { marque: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Taille</label>
                      <input value={it.taille} onChange={(e) => updateItem(i, { taille: e.target.value })} placeholder={it.tailleOriginale ? `orig: ${it.tailleOriginale}` : ''} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Couleur</label>
                      <input value={it.couleur} onChange={(e) => updateItem(i, { couleur: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">État</label>
                      <input value={it.etat} onChange={(e) => updateItem(i, { etat: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Description {it.descriptionOriginale ? '(corrigée)' : ''}</label>
                      <textarea value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} rows={3} className="w-full border rounded px-2 py-1.5 text-sm resize-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Catégorie</label>
                      <input value={it.categorie?.label || ''} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Prix d'achat (€)</label>
                      <input value={it.prixAchat != null ? String(it.prixAchat) : ''} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 font-semibold">Prix de vente (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.prixVente}
                        onChange={(e) => updateItem(i, { prixVente: e.target.value })}
                        placeholder={it.prixSuggere ? `suggéré : ${it.prixSuggere}` : ''}
                        className="w-full border rounded px-2 py-1.5 text-sm border-[#09B1BA]/40"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {errorMsg && (
              <div className="mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                ✗ {errorMsg}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setStep('paste')} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Retour</button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm font-medium text-white bg-[#09B1BA] hover:bg-[#078a91] rounded-lg"
              >
                Créer
              </button>
            </div>
          </>
        )}

        {step === 'creating' && (
          <div className="flex-1 flex items-center justify-center text-gray-600">Création en cours…</div>
        )}

        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="text-green-700 font-medium">{resultMsg}</div>
            <button onClick={onClose} className="px-4 py-2 bg-[#22209C] text-white text-sm rounded-lg">Fermer</button>
          </div>
        )}
      </div>
    </div>
  )
}
