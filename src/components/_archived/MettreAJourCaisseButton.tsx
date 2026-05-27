// ARCHIVE — Bouton "Mettre à jour en caisse" (page Produits)
//
// Retiré de ProductList.tsx car il ne sert à rien aujourd'hui : son
// handler ne pousse rien vers la caisse, il se contente de reset les
// états locaux (`dirtyIds`, `selectedIds`) et d'afficher une alerte.
//
// Le code est conservé ici pour le jour où on rebranchera une vraie
// synchro avec la caisse Square (ou autre). À ce moment-là :
//   1. remettre l'état `updatingSquare` + `hasChangesToSync` dans le
//      composant parent (ou les recevoir via props),
//   2. implémenter la vraie logique de sync dans `handleUpdateSquare`
//      (appel API, gestion d'erreurs, etc.),
//   3. ré-importer le bouton dans la barre d'actions de ProductList.
//
// Le marqueur visuel "dirty" (border gauche ambre sur les cartes,
// piloté par `dirtyIds`) est resté dans ProductList — il continue de
// signaler les pièces modifiées en batch, même sans bouton de sync.

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

type Props = {
  selectedIds: Set<string>
  dirtyIds: Set<string>
  setSelectedIds: (s: Set<string>) => void
  setDirtyIds: (s: Set<string>) => void
}

export default function MettreAJourCaisseButton({
  selectedIds,
  dirtyIds,
  setSelectedIds,
  setDirtyIds,
}: Props) {
  const [updatingSquare, setUpdatingSquare] = useState(false)
  const hasChangesToSync = selectedIds.size > 0 || dirtyIds.size > 0

  const handleUpdateSquare = async () => {
    const idsToSync = new Set([...selectedIds, ...dirtyIds])
    if (idsToSync.size === 0) {
      alert('Aucun produit à synchroniser')
      return
    }

    setUpdatingSquare(true)
    // TODO: vraie synchro caisse ici
    setDirtyIds(new Set())
    setSelectedIds(new Set())
    setUpdatingSquare(false)

    alert(`${idsToSync.size} produit(s) synchronisé(s)`)
  }

  return (
    <button
      onClick={handleUpdateSquare}
      disabled={!hasChangesToSync || updatingSquare}
      className="bg-black text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2 hover:bg-gray-800 transition-colors"
    >
      <RefreshCw size={16} className={updatingSquare ? 'animate-spin' : ''} />
      {updatingSquare ? 'Sync...' : 'Mettre à jour en caisse'}
    </button>
  )
}
