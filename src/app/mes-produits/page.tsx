

// =============================
// FILE: app/mes-produits/page.tsx
// SIMPLE: quand quantité <= 0 ⇒ suppression (UI + API). Bouton Supprimer ⇒ suppression partout.
// =============================

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
  getDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import Navbar from '@/components/Navbar'
import { MoreHorizontal, Trash2, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'

  type Produit = {
    id: string
    nom: string
    description?: string
    categorie?: any
    prix?: number
    quantite?: number
    codeBarre?: string
    imageUrl?: string
    photo?: string
    chineur?: string
    vendu?: boolean
    createdAt?: Timestamp
    dateVente?: Timestamp
    prixVenteReel?: number
    catalogObjectId?: string
    variationId?: string
    itemId?: string
    // traces
    statut?: 'retour' | 'supprime'
    dateRetour?: Timestamp | string
  }

export default function MesProduitsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  const [produits, setProduits] = useState<Produit[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [filtreCategorie, setFiltreCategorie] = useState<string>('')
  const [recherche, setRecherche] = useState<string>('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [menuOuvert, setMenuOuvert] = useState(false)

  // --- état pour la modale de suppression ---
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null)
  const [justif, setJustif] = useState<'erreur' | 'produit_recupere' | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Chargement initial
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push('/login')
        return
      }
      setUser(u)

      const qy = query(collection(db, 'produits'), where('chineur', '==', u.email))
      const snap = await getDocs(qy)
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Produit[]

      // Tri récents d'abord
      const dataTries = data.sort((a, b) => {
        const da = a.createdAt instanceof Timestamp ? a.createdAt.toDate().getTime() : 0
        const dbt = b.createdAt instanceof Timestamp ? b.createdAt.toDate().getTime() : 0
        return dbt - da
      })
      setProduits(dataTries)

      // Catégories uniques
      const uniqueCats = Array.from(
        new Set(
          dataTries
            .map((p) => (typeof p.categorie === 'object' ? p.categorie?.label : p.categorie))
            .filter(Boolean)
        )
      ) as string[]
      setCategories(uniqueCats)
    })
    return () => unsubscribe()
  }, [router])

  // --- Filtres (on masque 'supprime', on garde 'retour') ---
  const produitsFiltres = useMemo(() => {
    const needle = recherche.trim().toLowerCase()
    return produits
      .filter((p) => p.statut !== 'supprime')
      .filter((p) => {
        const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
        if (filtreCategorie && cat !== filtreCategorie) return false
        if (!needle) return true
        const hay = [
          p.nom || '',
          p.description || '',
          cat || '',
          String(p.prix ?? ''),
          String(p.quantite ?? ''),
          String(p.codeBarre ?? ''),
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(needle)
      })
  }, [produits, filtreCategorie, recherche])

  // actifs = pas "retour" ET quantité > 0
  const produitsActifs = useMemo(
    () => produitsFiltres.filter((p) => p.statut !== 'retour' && ((p.quantite ?? 1) > 0)),
    [produitsFiltres]
  )

  // rendus = statut "retour" OU quantité <= 0
  const produitsRendus = useMemo(
    () => produitsFiltres.filter((p) => p.statut === 'retour' || ((p.quantite ?? 0) <= 0)),
    [produitsFiltres]
  )

  // --- Sélection / sélection globale (seulement actifs !) ---
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = (checked: boolean, list: Produit[]) => {
    setSelectedIds(checked ? new Set(list.map((p) => p.id)) : new Set())
  }
  // --- Mettre à jour en caisse (création si absent, update sinon) ---
const handleUpdateSquare = async () => {
  if (!user) return
  try {
    // helper: normaliser les libellés (accents/majuscules/espaces)
    const normalize = (s: any) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

    // 1) lire la fiche chineuse pour mapper label -> idsquare (tolérant) 
    const chineuseRef = doc(db, 'chineuse', user.uid)
    const chineuseSnap = await getDoc(chineuseRef)
    const data = chineuseSnap.exists() ? chineuseSnap.data() : null

    const rawMap =
      (data as any)?.['Catégorie'] ??
      (data as any)?.['Catégories'] ??
      (data as any)?.['Categories'] ??
      (data as any)?.categories ??
      []

    const catRows: any[] = Array.isArray(rawMap) ? rawMap : []
    const labelToSquareId = (label: any): string | undefined => {
      const n = normalize(
        typeof label === 'object' ? (label?.label ?? label?.value) : label
      )
      const row = catRows.find((c) => normalize(c?.label ?? c?.value ?? c) === n)
      return (row?.idsquare || row?.idSquare || row?.squareId || row?.id) as string | undefined
    }

    // Catégories disponibles (déjà mappées à Square)
    const mappedChoices = catRows
      .filter((c) => c && (c.idsquare || c.idSquare || c.squareId || c.id))
      .map((c) => String(c.label ?? c.value ?? c))
      .filter(Boolean)

    // 2) pour chaque produit sélectionné
    for (const produit of produitsActifs.filter((p) => selectedIds.has(p.id))) {
      const rawLabel =
        typeof produit.categorie === 'object'
          ? (produit.categorie?.label ?? produit.categorie?.value)
          : produit.categorie

      let idsquare = labelToSquareId(rawLabel)

      // === A) CRÉATION si pas encore dans Square ===
      if (!produit.catalogObjectId && !produit.variationId && !produit.itemId) {
        // si la catégorie n'est pas mappée, on te laisse choisir une catégorie Square existante
        if (!idsquare) {
          const picked = prompt(
            `La catégorie "${rawLabel ?? '—'}" n'est pas mappée à Square pour « ${produit.nom} ».\n` +
            (mappedChoices.length
              ? `Choisis une catégorie parmi :\n${mappedChoices.join(' | ')}\n\nTape exactement le nom du menu.`
              : `Aucune catégorie Square mappée trouvée dans ta fiche. Ajoute "idsquare" sur tes catégories.`
            )
          )
          if (!picked) {
            alert(`Opération annulée pour « ${produit.nom} ».`)
            continue
          }
          const pickedId = labelToSquareId(picked)
          if (!pickedId) {
            alert(`Catégorie "${picked}" inconnue ou non mappée à Square.`)
            continue
          }
          // on met à jour la catégorie du produit pour rester cohérent à l'avenir
          await updateDoc(doc(db, 'produits', produit.id), { categorie: picked })
          setProduits((prev) => prev.map((p) => (p.id === produit.id ? { ...p, categorie: picked } : p)))
          idsquare = pickedId
        }

        // sécurité prix/nom
        if (!produit.nom || typeof produit.prix !== 'number' || Number.isNaN(produit.prix)) {
          alert(`Paramètres manquants pour « ${produit.nom || '(sans nom)'} » (prix requis).`)
          continue
        }

        const res = await fetch('/api/import-square-produits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nom: produit.nom,
            prix: produit.prix,
            description: produit.description,
            codeBarre: produit.codeBarre,
            categorie: idsquare,              // ✅ ID de catégorie Square choisi
            chineurNom: user.uid,
            chineurEmail: user.email,
            stock: produit.quantite ?? 1,
            imageUrl: produit.imageUrl,
          }),
        })

        const text = await res.text()
        let data: any = {}
        try { data = JSON.parse(text) } catch {}
        if (!res.ok || !data?.success) {
          console.warn('Erreur création Square:', text.slice(0, 200))
          alert(`Square: création échouée pour « ${produit.nom} »`)
          continue
        }

        // MAJ Firestore + état local avec les IDs Square renvoyés
        const update: Record<string, any> = {}
        if (data.catalogObjectId) update.catalogObjectId = data.catalogObjectId
        if (data.variationId) update.variationId = data.variationId
        if (data.itemId) update.itemId = data.itemId

        if (Object.keys(update).length > 0) {
          await updateDoc(doc(db, 'produits', produit.id), update)
          setProduits((prev) => prev.map((p) => (p.id === produit.id ? { ...p, ...update } : p)))
        }
      } else {
        // === B) UPDATE si déjà en caisse (NE TOUCHE PAS à la catégorie Square) ===
        const res = await fetch('/api/update-square-produit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: produit.itemId,
            variationId: produit.variationId || produit.catalogObjectId, // fallback
            nom: produit.nom,
            description: produit.description,
            prix: produit.prix,
            codeBarre: produit.codeBarre,
            // ⚠️ pas de "categorie" en update pour ne pas casser la catégorie existante
            stock: produit.quantite ?? 1,
          }),
        })

        const text = await res.text()
        let data: any = {}
        try { data = JSON.parse(text) } catch {}
        if (!res.ok || !data?.success) {
          console.warn('Erreur update Square:', text.slice(0, 200))
          alert(`Square: mise à jour échouée pour « ${produit.nom} »`)
          continue
        }
      }
    }

    alert('Caisse Square mise à jour ✅')
  } catch (error) {
    console.error(error)
    alert('Erreur réseau lors de la mise à jour Square')
  }
}

  // --- Helper suppression partout ---
  const deleteEverywhere = async (id: string, reason: 'erreur' | 'produit_recupere' = 'erreur') => {
    if (!user) return
    const token = await user.getIdToken()
    const res = await fetch('/api/delete-produits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ productId: id, reason }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.error || 'Erreur API (suppression)')
    }
    // UI: on enlève l'élément localement
    setProduits((prev) => prev.filter((p) => p.id !== id))
    setSelectedIds((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
  }

  // --- Ouvre la modale (unitaire) ---
  const openDeleteSingle = (id: string) => {
    setConfirmIds([id])
    setJustif(null)
  }

  // --- Ouvre la modale (sélection) ---
  const openDeleteBulk = () => {
    if (selectedIds.size === 0) return
    setConfirmIds(Array.from(selectedIds))
    setJustif(null)
  }

  // --- Confirme la suppression (appelle l’API) ---
  const confirmDelete = async () => {
    if (!user || !confirmIds || !justif) return
    setDeleting(true)
    try {
      for (const id of confirmIds) {
        // eslint-disable-next-line no-await-in-loop
        await deleteEverywhere(id, justif)
      }
      setConfirmIds(null)
      setJustif(null)
      setMenuOuvert(false)
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Erreur réseau')
    } finally {
      setDeleting(false)
    }
  }

  // 🔴 SUPPRESSION SIMPLE (prompt + confirm) — sans la modale
  const quickDelete = async (id: string) => {
    if (!user) {
      alert('Non connecté')
      return
    }

    const choice = prompt('Justification : tape "erreur" ou "produit_recupere"', 'erreur')
    if (!choice) return
    const reason = choice === 'produit_recupere' ? 'produit_recupere' : 'erreur'

    const ok = confirm('Confirmer la suppression (page + caisse) ?')
    if (!ok) return

    try {
      await deleteEverywhere(id, reason)
    } catch (e: any) {
      alert(e?.message || 'Erreur réseau')
    }
  }

  // --- MAJ groupées (prix / categorie / quantite) ---
  const handleBatchUpdate = async (field: 'prix' | 'categorie' | 'quantite', value: any) => {
    if (selectedIds.size === 0) return

    // 1) on met à jour Firestore
    for (const id of selectedIds) {
      // eslint-disable-next-line no-await-in-loop
      await updateDoc(doc(db, 'produits', id), { [field]: value })
    }
    // 2) UI
    setProduits((prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, [field]: value } : p)))
    setMenuOuvert(false)

    // 3) Si quantité <= 0, on supprime partout
    if (field === 'quantite' && Number(value) <= 0) {
      for (const id of Array.from(selectedIds)) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await deleteEverywhere(id, 'erreur')
        } catch (e) {
          console.warn('Suppression auto à 0 échouée pour', id, e)
        }
      }
    }
  }

  // --- Sauvegarde d’un produit en mode édition ---
  const handleSaveEdit = async (p: Produit) => {
    const changes = formData[p.id]
    if (!changes) {
      setEditingId(null)
      return
    }
    await updateDoc(doc(db, 'produits', p.id), changes)

    // Si quantité devient 0 ⇒ suppression partout
    if (Object.prototype.hasOwnProperty.call(changes, 'quantite') && Number(changes.quantite) <= 0) {
      try {
        await deleteEverywhere(p.id, 'erreur')
        setEditingId(null)
        return
      } catch (e) {
        console.warn('Suppression auto à 0 échouée pour', p.id, e)
      }
    }

    setProduits((prev) => prev.map((it) => (it.id === p.id ? { ...it, ...changes } : it)))
    setEditingId(null)
  }

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-center text-primary uppercase mb-6">
          MES PRODUITS CHEZ NOUVELLE RIVE
        </h1>

        {/* Filtres haut */}
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex-1 min-w-[220px]">
            <label className="mr-2 font-medium block mb-1">Filtrer par catégorie :</label>
            <select
              value={filtreCategorie}
              onChange={(e) => setFiltreCategorie(e.target.value)}
              className="border px-2 py-2 rounded w-full"
            >
              <option value="">Toutes</option>
              {categories.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[260px]">
            <label className="mr-2 font-medium block mb-1">Rechercher :</label>
            <input
              type="text"
              placeholder="ex: cuir, 35, veste..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="border px-2 py-2 rounded w-full"
            />
          </div>

          <div className="self-end mt-6">
                        <button
              onClick={handleUpdateSquare}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={selectedIds.size === 0}
            >
              🔄 Mettre à jour en caisse
            </button>
          </div>
        </div>

        {/* Menu d’actions sur la sélection (que pour actifs) */}
        {selectedIds.size > 0 && (
          <div className="relative mb-3">
            <button
              onClick={() => setMenuOuvert(!menuOuvert)}
              className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-1"
            >
              Modifier <ChevronDown size={16} />
            </button>
            {menuOuvert && (
              <div className="absolute mt-2 w-56 bg-white shadow-md rounded border z-10">
                <button
                  onClick={() => {
                    const prix = prompt('Nouveau prix ?')
                    if (prix) handleBatchUpdate('prix', parseFloat(prix))
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Modifier le prix
                </button>
                <button
                  onClick={() => {
                    const cat = prompt('Nouvelle catégorie ?')
                    if (cat) handleBatchUpdate('categorie', cat)
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Modifier la catégorie
                </button>
                <button
                  onClick={() => {
                    const qte = prompt('Nouvelle quantité ?')
                    if (qte) handleBatchUpdate('quantite', parseInt(qte))
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Modifier la quantité
                </button>
                <button
                  onClick={openDeleteBulk}
                  className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                >
                  Supprimer (page + caisse)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sélection globale (seulement actifs) */}
        <div className="mb-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.size === produitsActifs.length && produitsActifs.length > 0}
              onChange={(e) => toggleAll(e.target.checked, produitsActifs)}
            />
            Tout sélectionner ({selectedIds.size})
          </label>
        </div>

        {/* Liste des produits ACTIFS */}
        <div className="space-y-6">
          {produitsActifs.map((p) => {
            const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
            const img = p.imageUrl || p.photo
            return (
              <div
                key={p.id}
                className="border p-4 rounded-md shadow-md grid grid-cols-5 gap-4 items-start"
              >
                {/* Checkbox sélection (actifs uniquement) */}
                <div>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelection(p.id)}
                  />
                </div>

                {/* Contenu */}
                <div className="col-span-4 grid grid-cols-4 gap-4">
                  {editingId === p.id ? (
                    <div className="col-span-4 space-y-2">
                      <input
                        type="text"
                        value={formData[p.id]?.nom ?? p.nom ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [p.id]: { ...formData[p.id], nom: e.target.value },
                          })
                        }
                        placeholder="Nom"
                        className="w-full border px-2 py-1 rounded"
                      />
                      <input
                        type="text"
                        value={formData[p.id]?.description ?? p.description ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [p.id]: { ...formData[p.id], description: e.target.value },
                          })
                        }
                        placeholder="Description"
                        className="w-full border px-2 py-1 rounded"
                      />
                      <input
                        type="number"
                        value={formData[p.id]?.prix ?? p.prix ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [p.id]: {
                              ...formData[p.id],
                              prix: parseFloat(e.target.value),
                            },
                          })
                        }
                        placeholder="Prix"
                        className="w-full border px-2 py-1 rounded"
                      />
                      <input
                        type="number"
                        value={formData[p.id]?.quantite ?? p.quantite ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [p.id]: {
                              ...formData[p.id],
                              quantite: parseInt(e.target.value),
                            },
                          })
                        }
                        placeholder="Quantité"
                        className="w-full border px-2 py-1 rounded"
                      />
                      <select
                        value={formData[p.id]?.categorie ?? (typeof p.categorie === 'object' ? p.categorie?.label : p.categorie) ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [p.id]: { ...formData[p.id], categorie: e.target.value },
                          })
                        }
                        className="w-full border px-2 py-1 rounded"
                      >
                        <option value="">Sélectionner une catégorie</option>
                        {categories.map((c, idx) => (
                          <option key={idx} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleSaveEdit(p)}
                          className="bg-blue-600 text-white px-4 py-1 rounded"
                        >
                          Enregistrer
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="bg-gray-300 px-4 py-1 rounded"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-semibold text-lg">{p.nom}</p>
                        {p.description && (
                          <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Importé le{' '}
                          {p.createdAt instanceof Timestamp
                            ? format(p.createdAt.toDate(), 'dd/MM/yyyy à HH:mm')
                            : '—'}
                        </p>
                        {(p.imageUrl || p.photo) && (
                          <img
                            src={img!}
                            alt={p.nom}
                            className="mt-2 max-w-[150px] rounded border"
                          />
                        )}
                      </div>

                      <div className="text-sm space-y-2">
                        <p>
                          <span className="text-gray-700">Catégorie :</span>{' '}
                          <span className="font-medium">
                            {typeof p.categorie === 'object' ? p.categorie?.label : p.categorie ?? '—'}
                          </span>
                        </p>
                        <p>
                          <span className="text-gray-700">Quantité :</span>{' '}
                          <span className="font-medium">{p.quantite ?? 1}</span>
                        </p>
                      </div>

                      <div className="text-sm">
                        <p>
                          <span className="text-gray-700">Prix :</span>{' '}
                          <span className="font-medium">{p.prix} €</span>
                        </p>
                        {p.vendu && (
                          <p className="text-green-700">
                            Vendu le{' '}
                            {p.dateVente instanceof Timestamp
                              ? format(p.dateVente.toDate(), 'dd/MM/yyyy')
                              : '—'}
                            {typeof p.prixVenteReel === 'number'
                              ? ` • ${p.prixVenteReel} €`
                              : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex items-start justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingId(p.id)
                            setFormData((prev) => ({
                              ...prev,
                              [p.id]: {
                                nom: p.nom,
                                description: p.description,
                                prix: p.prix,
                                quantite: p.quantite,
                                categorie:
                                  typeof p.categorie === 'object'
                                    ? p.categorie?.label
                                    : p.categorie ?? '',
                                imageUrl: p.imageUrl ?? '',
                              },
                            }))
                          }}
                          className="text-gray-600 hover:text-black"
                          title="Modifier"
                        >
                          <MoreHorizontal size={20} />
                        </button>
                        <button
                        onClick={() => openDeleteSingle(p.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Supprimer (page + caisse)"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Section PRODUITS RENDUS */}
        {produitsRendus.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold mb-4">Produits rendus</h2>
            <div className="space-y-6">
              {produitsRendus.map((p) => {
                const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
                const img = p.imageUrl || p.photo
                const retourDate =
                  p.dateRetour instanceof Timestamp
                    ? p.dateRetour.toDate()
                    : p.dateRetour
                    ? new Date(p.dateRetour as any)
                    : null

                return (
                  <div
                    key={p.id}
                    className="border p-4 rounded-md shadow-sm grid grid-cols-5 gap-4 items-start bg-gray-50"
                  >
                    {/* Pas de checkbox pour rendus */}
                    <div />

                    <div className="col-span-4 grid grid-cols-4 gap-4 opacity-90">
                      <div>
                        <p className="font-semibold text-lg">{p.nom}</p>
                        {p.description && (
                          <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                        )}
                        <p className="text-xs mt-2 text-amber-700">
                          Rendu le {retourDate ? format(retourDate, 'dd/MM/yyyy') : '—'}
                        </p>
                        {(p.imageUrl || p.photo) && (
                          <img
                            src={img!}
                            alt={p.nom}
                            className="mt-2 max-w-[150px] rounded border"
                          />
                        )}
                      </div>

                      <div className="text-sm space-y-2">
                        <p>
                          <span className="text-gray-700">Catégorie :</span>{' '}
                          <span className="font-medium">{cat ?? '—'}</span>
                        </p>
                        <p>
                          <span className="text-gray-700">Quantité :</span>{' '}
                          <span className="font-medium">{p.quantite ?? 1}</span>
                        </p>
                      </div>

                      <div className="text-sm">
                        <p>
                          <span className="text-gray-700">Prix :</span>{' '}
                          <span className="font-medium">{p.prix} €</span>
                        </p>
                      </div>

                      {/* Boutons gris (disabled) pour visuel */}
                      <div className="flex items-start justify-end gap-2 opacity-40 cursor-not-allowed">
                        <MoreHorizontal size={20} />
                        <Trash2 size={20} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modal justification (single ou bulk) */}
      {confirmIds && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-3">Justification</h3>
            <p className="text-sm text-gray-600 mb-3">
              Pourquoi souhaitez-vous retirer {confirmIds.length > 1 ? 'ces articles' : 'cet article'} ?
            </p>

            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="justif"
                  checked={justif === 'erreur'}
                  onChange={() => setJustif('erreur')}
                />
                <span>Erreur (créé par erreur / information incorrecte)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="justif"
                  checked={justif === 'produit_recupere'}
                  onChange={() => setJustif('produit_recupere')}
                />
                <span>Produit récupéré par la chineuse</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setConfirmIds(null); setJustif(null) }}
                className="px-4 py-2 rounded border"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={!justif || deleting}
                className="px-4 py-2 rounded text-white"
                style={{ background: '#e11d48', opacity: !justif || deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
