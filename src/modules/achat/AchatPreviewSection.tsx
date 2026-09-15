// Aperçu des lots/pièces importés (Vinted/Whatnot/Fleek) — rendu en flow de
// page, pas dans une modal, pour bénéficier du scroll natif (sinon ça saute
// quand on remplit les champs).
//
// Le parent (page admin) gère le state `items` et appelle ce composant quand
// l'import est prêt à être validé. Bouton Annuler = revient au ProductForm
// classique. Bouton Créer = appelle /api/achat/import-manual.

'use client'

import { useCallback, useState } from 'react'
import { auth } from '@/lib/firebaseConfig'
import { ItemCard, type ItemFields } from './ImportMailModal'

type Props = {
  initialItems: ItemFields[]
  targetChineuse: { uid: string; email: string; trigramme: string }
  categories: { label: string; idsquare?: string }[]
  onCancel: () => void
  onCreated: () => void
}

export default function AchatPreviewSection({
  initialItems,
  targetChineuse,
  categories,
  onCancel,
  onCreated,
}: Props) {
  const [items, setItems] = useState<ItemFields[]>(initialItems)
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const updateItem = useCallback((i: number, patch: Partial<ItemFields>) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }, [])

  const handleCreate = async () => {
    // Validation identique à l'ancienne modal
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const isFleek = it.provenance === 'fleek'
      const prefix = items.length > 1 ? (isFleek ? `Lot ${i + 1} : ` : `Pièce ${i + 1} : `) : ''
      if (!it.titre?.trim()) { setErrorMsg(`${prefix}le titre est obligatoire.`); return }
      if (!it.categorie?.label?.trim()) { setErrorMsg(`${prefix}la catégorie est obligatoire.`); return }
      if (!isFleek) {
        if (!it.marque?.trim()) { setErrorMsg(`${prefix}la marque est obligatoire.`); return }
        if (!it.taille?.trim()) { setErrorMsg(`${prefix}la taille est obligatoire.`); return }
      }
      if (isFleek) {
        const qty = Number(it.quantiteLot)
        if (!Number.isFinite(qty) || qty <= 0) { setErrorMsg(`${prefix}quantité du lot manquante.`); return }
      }
      const pv = parseFloat(it.prixVente || '')
      if (!Number.isFinite(pv) || pv <= 0) { setErrorMsg(`${prefix}prix de vente manquant ou invalide.`); return }
    }
    setCreating(true)
    setErrorMsg(null)
    try {
      const user = auth.currentUser
      if (!user) { setErrorMsg('Tu n\'es pas connectée.'); setCreating(false); return }
      const idToken = await user.getIdToken()
      const res = await fetch('/api/achat/import-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ validatedItems: items, targetChineuse }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) {
        setErrorMsg(json.reason || json.error || `Erreur ${res.status}`)
        setCreating(false)
        return
      }
      onCreated()
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erreur inattendue')
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Vérifie avant création — {items.length} {items[0]?.provenance === 'fleek' ? 'lot(s)' : 'pièce(s)'}</h3>
          <p className="text-xs text-gray-500 mt-0.5">Corrige si besoin et saisis le prix de vente, puis valide.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={creating}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-1.5 text-sm font-medium text-white bg-[#09B1BA] hover:bg-[#078a91] disabled:opacity-50 rounded-lg"
          >
            {creating ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>

      {items.map((it, i) => (
        <ItemCard
          key={i}
          item={it}
          index={i}
          total={items.length}
          categories={categories}
          onPatch={updateItem}
        />
      ))}

      {errorMsg && (
        <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
          ✗ {errorMsg}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={creating}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2 text-sm font-medium text-white bg-[#09B1BA] hover:bg-[#078a91] disabled:opacity-50 rounded-lg"
        >
          {creating ? 'Création…' : 'Créer'}
        </button>
      </div>
    </div>
  )
}
