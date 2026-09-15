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

import { memo, useCallback, useState } from 'react'
import { X } from 'lucide-react'
import { auth } from '@/lib/firebaseConfig'
import { ADMIN_EMAIL } from '@/lib/roles'
import { MOTIF_OPTIONS } from '@/lib/motifs'
import { MODELES_COMMUNS } from '@/lib/modeles'

type Props = {
  onClose: () => void
  targetChineuse?: { uid: string; email: string; trigramme: string }
  /** Catégories de la chineuse cible (pour le select de catégorie). Si vide,
   *  le champ reste en lecture seule avec uniquement la valeur auto-détectée. */
  categories?: { label: string; idsquare?: string }[]
  /** Si fourni, appelé avec les items extraits dès qu'ils sont prêts pour
   *  l'aperçu — la modal se ferme et le parent rend l'éditeur en flow de page
   *  (pas dans une modal) pour éviter les sauts de scroll. */
  onItemsReady?: (items: ItemFields[]) => void
  /** Contexte acheteuse / non-admin : n'affiche QUE Vinted, aucune mention
   *  Whatnot (même si un admin est connecté et teste cet espace). */
  vintedOnly?: boolean
}

export type ItemFields = {
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
  // Champs secondaires (comme le formulaire produit)
  modele?: string
  motif?: string
  sleeveLength?: string
  collarType?: string
  garmentLength?: string
  closureType?: string
  description: string
  descriptionOriginale?: string
  vendeur: string
  prixAchat: number | null
  /** Frais de port (livraison) — exclus TVA, inclus coût acheteuse */
  fraisPort?: number | null
  prixSuggere: number | null
  categorie: { label?: string; idsquare?: string } | null
  prixVente: string // saisi par l'admin, requis
}

type Step = 'paste' | 'preview' | 'creating' | 'done'

// Card d'un item dans l'aperçu, isolée + memoizée : édition de la pièce N
// ne re-render plus les autres pièces → plus de focus glitch / scroll jump.
export const ItemCard = memo(function ItemCard({
  item,
  index,
  total,
  categories,
  onPatch,
}: {
  item: ItemFields
  index: number
  total: number
  categories: { label: string; idsquare?: string }[]
  onPatch: (i: number, patch: Partial<ItemFields>) => void
}) {
  return (
    <div className="border rounded-xl p-4 bg-gray-50">
      {total > 1 && (
        <div className="text-xs font-semibold text-[#09B1BA] mb-2">
          {`Pièce ${index + 1}/${total}`}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Titre</label>
          <input value={item.titre} onChange={(e) => onPatch(index, { titre: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Marque</label>
          <input value={item.marque} onChange={(e) => onPatch(index, { marque: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Taille</label>
          <input value={item.taille} onChange={(e) => onPatch(index, { taille: e.target.value })} placeholder={item.tailleOriginale ? `orig: ${item.tailleOriginale}` : ''} className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Couleur</label>
          <input value={item.couleur} onChange={(e) => onPatch(index, { couleur: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">État</label>
          <input value={item.etat} onChange={(e) => onPatch(index, { etat: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Modèle</label>
          <input value={item.modele || ''} list={`import-modele-${index}`} onChange={(e) => onPatch(index, { modele: e.target.value })} placeholder="ex: Blazer, Oversized…" className="w-full border rounded px-2 py-1.5 text-sm" />
          <datalist id={`import-modele-${index}`}>{MODELES_COMMUNS.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
        <div>
          <label className="text-xs text-gray-500">Motif</label>
          <input value={item.motif || ''} list={`import-motif-${index}`} onChange={(e) => onPatch(index, { motif: e.target.value })} placeholder="ex: Floral, Rayures…" className="w-full border rounded px-2 py-1.5 text-sm" />
          <datalist id={`import-motif-${index}`}>{MOTIF_OPTIONS.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
        <div>
          <label className="text-xs text-gray-500">Manches</label>
          <input value={item.sleeveLength || ''} onChange={(e) => onPatch(index, { sleeveLength: e.target.value })} placeholder="courtes / longues…" className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Col</label>
          <input value={item.collarType || ''} onChange={(e) => onPatch(index, { collarType: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Longueur</label>
          <input value={item.garmentLength || ''} onChange={(e) => onPatch(index, { garmentLength: e.target.value })} placeholder="courte / longue…" className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Fermeture</label>
          <input value={item.closureType || ''} onChange={(e) => onPatch(index, { closureType: e.target.value })} placeholder="zip / boutons…" className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Description {item.descriptionOriginale ? '(corrigée)' : ''}</label>
          <textarea value={item.description} onChange={(e) => onPatch(index, { description: e.target.value })} rows={3} className="w-full border rounded px-2 py-1.5 text-sm resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Catégorie *</label>
          {categories.length > 0 ? (
            <select
              value={item.categorie?.label || ''}
              onChange={(e) => {
                const label = e.target.value
                const match = categories.find((c) => c.label === label) || null
                onPatch(index, { categorie: match ? { label: match.label, idsquare: match.idsquare } : null })
              }}
              className="w-full border rounded px-2 py-1.5 text-sm bg-white"
            >
              <option value="">Choisir…</option>
              {categories.map((c) => (
                <option key={c.label} value={c.label}>{c.label}</option>
              ))}
            </select>
          ) : (
            <input value={item.categorie?.label || ''} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
          )}
        </div>
        <div>
          <label className="text-xs text-gray-500">Prix d'achat (€) <span className="text-gray-400">art. + protection</span></label>
          <input value={item.prixAchat != null ? String(item.prixAchat) : ''} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Frais de port (€)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={item.fraisPort != null ? String(item.fraisPort) : ''}
            onChange={(e) => onPatch(index, { fraisPort: e.target.value === '' ? null : parseFloat(e.target.value) })}
            placeholder="ex: 4.95"
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 font-semibold">
            Prix de vente (€) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={item.prixVente}
            onChange={(e) => onPatch(index, { prixVente: e.target.value })}
            placeholder={item.prixSuggere ? `suggéré : ${item.prixSuggere}` : ''}
            className="w-full border rounded px-2 py-1.5 text-sm border-[#09B1BA]/40"
            required
          />
        </div>
      </div>
    </div>
  )
})

export default function ImportMailModal({ onClose, targetChineuse, categories = [], onItemsReady, vintedOnly }: Props) {
  const [step, setStep] = useState<Step>('paste')
  const [pasted, setPasted] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [items, setItems] = useState<ItemFields[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const verifyWithBody = async (body: string) => {
    if (!body.trim()) {
      setErrorMsg('Le contenu est vide.')
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
        body: JSON.stringify({ body, targetChineuse: targetChineuse || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) {
        setErrorMsg(json.reason || json.error || `Erreur ${res.status}`)
        return
      }
      const raw: ItemFields[] =
        json.kind === 'whatnot-purchase'
          ? json.items.map((it: any) => ({ ...it, prixVente: it.prixSuggere ? String(it.prixSuggere) : '' }))
          : [{ ...json.fields, prixVente: json.fields.prixSuggere ? String(json.fields.prixSuggere) : '' }]
      // Si le parent gère le preview en flow page (recommandé pour éviter les
      // sauts de scroll), on lui passe la main et on ferme la modal.
      if (onItemsReady) {
        onItemsReady(raw)
        onClose()
        return
      }
      setItems(raw)
      setStep('preview')
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erreur inattendue')
    } finally {
      setVerifying(false)
    }
  }

  // Stable via useCallback pour que ItemCard memoizé ne re-render pas
  // quand une autre card est modifiée.
  const updateItem = useCallback((i: number, patch: Partial<ItemFields>) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }, [])

  const handleVerify = () => verifyWithBody(pasted)

  const handleCreate = async () => {
    // validation : tous les champs obligatoires doivent être remplis avant création
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const prefix = items.length > 1 ? `Pièce ${i + 1} : ` : ''
      if (!it.titre?.trim()) {
        setErrorMsg(`${prefix}le titre est obligatoire.`)
        return
      }
      if (!it.categorie?.label?.trim()) {
        setErrorMsg(`${prefix}la catégorie est obligatoire (non détectée auto, à compléter à la main après création).`)
        return
      }
      if (!it.marque?.trim()) {
        setErrorMsg(`${prefix}la marque est obligatoire.`)
        return
      }
      if (!it.taille?.trim()) {
        setErrorMsg(`${prefix}la taille est obligatoire.`)
        return
      }
      const pv = parseFloat(it.prixVente || '')
      if (!Number.isFinite(pv) || pv <= 0) {
        setErrorMsg(`${prefix}prix de vente manquant ou invalide.`)
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
        className="bg-white rounded-2xl max-w-3xl w-full shadow-xl flex flex-col"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-3 shrink-0 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {step === 'preview' ? 'Vérifie avant création' : 'Importer depuis Vinted'}
            </h2>
            {step === 'paste' && (
              <p className="text-sm text-gray-500 mt-1">
                Colle ici la page Vinted.
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
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 flex flex-col">
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Colle ici la page Vinted…"
              className="flex-1 min-h-[200px] w-full border border-gray-300 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#09B1BA] resize-none"
            />
            {errorMsg && (
              <div className="mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                ✗ {errorMsg}
              </div>
            )}
            </div>
            <div className="px-6 pt-3 pb-6 flex justify-end gap-2 shrink-0 border-t border-gray-100">
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
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4">
              {items.map((it, i) => (
                <div key={i} className="border rounded-xl p-4 bg-gray-50">
                  {items.length > 1 && (
                    <div className="text-xs font-semibold text-[#09B1BA] mb-2">
                      {`Pièce ${i + 1}/${items.length}`}
                    </div>
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
                      <label className="text-xs text-gray-500">Catégorie *</label>
                      {categories.length > 0 ? (
                        <select
                          value={it.categorie?.label || ''}
                          onChange={(e) => {
                            const label = e.target.value
                            const match = categories.find((c) => c.label === label) || null
                            updateItem(i, { categorie: match ? { label: match.label, idsquare: match.idsquare } : null })
                          }}
                          className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                        >
                          <option value="">Choisir…</option>
                          {categories.map((c) => (
                            <option key={c.label} value={c.label}>{c.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input value={it.categorie?.label || ''} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Prix d'achat unitaire (€)</label>
                      <input value={it.prixAchat != null ? String(it.prixAchat) : ''} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 font-semibold">
                        Prix de vente (€) *
                      </label>
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
              {errorMsg && (
                <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                  ✗ {errorMsg}
                </div>
              )}
            </div>
            <div className="px-6 pt-3 pb-6 flex justify-end gap-2 shrink-0 border-t border-gray-100">
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
          <div className="flex-1 flex items-center justify-center text-gray-600 p-6">Création en cours…</div>
        )}

        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            <div className="text-green-700 font-medium">{resultMsg}</div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                Fermer
              </button>
              <button
                onClick={() => {
                  // reset complet pour enchaîner sur une autre pièce
                  setPasted('')
                  setItems([])
                  setErrorMsg(null)
                  setResultMsg(null)
                  setStep('paste')
                }}
                className="px-4 py-2 bg-[#09B1BA] text-white text-sm rounded-lg hover:bg-[#078a91]"
              >
                Ajouter une autre pièce
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
