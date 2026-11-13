// app/admin/ebay/page.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { getBrandPriority, isPieceLuxe, ordreEbay } from '@/lib/admin/helpers'
import { db } from '@/lib/firebaseConfig'
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import EbayPostingCalendar from './EbayPostingCalendar'
import { formatPrixEuro } from '@/lib/formatPrix'

export default function AdminEbayPage() {
  const { produitsFiltres, loadData, loading } = useAdmin()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [publishing, setPublishing] = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [genderModal, setGenderModal] = useState<{ productIds: string[] } | null>(null)
  const [filterBrand, setFilterBrand] = useState('')
  const [search, setSearch] = useState('')
  const [filterChineuse, setFilterChineuse] = useState('')

  // Sexe choisi via les boutons H/F (affichage immédiat, sans recharger la page)
  const [genreLocal, setGenreLocal] = useState<Record<string, 'women' | 'men'>>({})
  const choisirSexe = async (id: string, g: 'women' | 'men') => {
    try {
      await updateDoc(doc(db, 'produits', id), { gender: g })
      setGenreLocal(prev => ({ ...prev, [id]: g }))
    } catch (err: any) {
      alert(`❌ Sexe non enregistré : ${err?.message || 'erreur'}`)
    }
  }

  const [chineusesList, setChineusesList] = useState<{trigramme: string, wearType: string}[]>([])

useEffect(() => {
  const unsub = onSnapshot(collection(db, 'chineuse'), (snap) => {
    setChineusesList(snap.docs.map(d => ({
      trigramme: d.data().trigramme || '',
      wearType: d.data().wearType || 'womenswear',
    })))
  })
  return () => unsub()
}, [])

  // Filtrer les produits actifs
  const produitsActifs = produitsFiltres.filter(p =>
    isPieceLuxe(p) &&
    (p.quantite ?? 1) > 0 &&
    p.vendu !== true &&
    p.statut !== 'vendu' &&
    p.statut !== 'supprime' &&
    p.statut !== 'retour'
  )

  const trigrammes = useMemo(() => {
    const set = new Set<string>()
    produitsActifs.forEach(p => {
      const tri = p.sku?.match(/^[A-Z]+/)?.[0]
      if (tri) set.add(tri)
    })
    return Array.from(set).sort()
  }, [produitsActifs])

  // Produits filtrés et triés
  const produitsEbay = useMemo(() => {
    let result = [...produitsActifs]

    if (filterBrand) {
      result = result.filter(p => 
        p.marque?.toLowerCase().includes(filterBrand.toLowerCase())
      )
    }

    if (search.trim()) {
      const needle = search.toLowerCase()
      result = result.filter(p =>
        p.nom?.toLowerCase().includes(needle) ||
        p.marque?.toLowerCase().includes(needle) ||
        p.sku?.toLowerCase().includes(needle)
      )
    }

    if (filterChineuse) {
      result = result.filter(p => {
        const trigramme = p.sku?.match(/^[A-Z]+/)?.[0] || ''
        return trigramme.toLowerCase() === filterChineuse.toLowerCase()
      })
    }

    // Tri : luxe en premier, puis par prix décroissant
    result.sort((a, b) => {
      const priorityA = getBrandPriority(a.marque)
      const priorityB = getBrandPriority(b.marque)
      if (priorityA !== priorityB) return priorityA - priorityB
      return (b.prix ?? 0) - (a.prix ?? 0)
    })

    return result
  }, [produitsActifs, filterBrand, search, filterChineuse])

  const getMainImage = (p: any): string | null => {
    if (p.photos?.face) return p.photos.face
    if (p.photos?.faceOnModel) return p.photos.faceOnModel
    if (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) return p.imageUrls[0]
    if (p.imageUrl) return p.imageUrl
    return null
  }

  // Nb de photos que la publi eBay enverrait (même logique que prepareProductForEbay)
  const compterPhotos = (p: any): number => {
    if (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) return p.imageUrls.length
    if (p.photos?.face) return [p.photos.face, p.photos.faceOnModel, p.photos.dos, ...(p.photos.details || [])].filter(Boolean).length
    if (p.imageUrl) return 1
    return 0
  }

  // Sexe résolu comme à la publi : champ gender du produit, sinon wearType de la chineuse
  const resoudreSexe = (p: any): 'Femme' | 'Homme' | null => {
    if (genreLocal[p.id] === 'women') return 'Femme'
    if (genreLocal[p.id] === 'men') return 'Homme'
    if (p.gender === 'women') return 'Femme'
    if (p.gender === 'men') return 'Homme'
    const tri = (p.chineuse || p.trigramme || p.sku?.match(/^[A-Z]+/)?.[0] || '').toUpperCase()
    const wt = chineusesList.find(c => c.trigramme?.toUpperCase() === tri)?.wearType
    if (wt === 'womenswear') return 'Femme'
    if (wt === 'menswear') return 'Homme'
    return null
  }

  // Raison qui empêche la publication eBay (null = prête à publier)
  const blocageEbay = (p: any): string | null => {
    if (p.hidden === true || p.forceDisplay === false) return 'Masquée sur le site'
    if (p.recu !== true) return 'Pas encore reçue en boutique'
    if (p.statutRecuperation) return 'Signalée à récupérer'
    const nb = compterPhotos(p)
    if (nb === 0) return 'Aucune photo'
    if (nb < 5) return `${nb} photo(s) — il en faut 5`
    if (!resoudreSexe(p)) return 'Sexe inconnu (chineuse unisexe / trigramme inconnu)'
    return null
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // En ligne / prêtes (calendrier du robot) / bloquées (problèmes à gérer, avec la raison)
  const enLigne = produitsEbay.filter(p => p.ebayListingId)
  const pretes = produitsEbay.filter(p => !p.ebayListingId && blocageEbay(p) === null)
  const bloquees = produitsEbay.filter(p => !p.ebayListingId && blocageEbay(p) !== null)


  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pretes.map(p => p.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const publishToEbay = async (productIds: string[], gender: string) => {
    if (productIds.length === 0) return

    setPublishing(true)
    try {
      const res = await fetch('/api/ebay/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, gender })
      })
      const data = await res.json()
      if (data.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || productIds.length
        alert(`✅ ${successCount} produit(s) publié(s) sur eBay !`)
        await loadData()
      } else {
        const raisons = data.results
          ?.filter((r: any) => !r.success)
          .map((r: any) => `${r.productId} : ${r.error || 'erreur inconnue'}`)
          .join('\n')
        alert(`❌ Échec publication eBay :\n${raisons || data.error || 'erreur inconnue'}`)
      }
    } catch (err: any) {
      alert(`❌ Erreur réseau : ${err?.message || 'inconnue'}`)
    } finally {
      setPublishing(false)
      setSelectedIds(new Set())
      setPublishingId(null)
    }
  }

  const askGenderThenPublish = (productIds: string[]) => {
    if (productIds.length === 0) return
    
    const genders = new Set<string>()
    for (const id of productIds) {
      const p = produitsActifs.find(pr => pr.id === id)
      const tri = p?.sku?.match(/^[A-Z]+/)?.[0]?.toUpperCase()
      const ch = chineusesList.find(c => c.trigramme?.toUpperCase() === tri)
      const wt = ch?.wearType || ''
      if (wt === 'womenswear') genders.add('Femme')
      else if (wt === 'menswear') genders.add('Homme')
      else genders.add('unknown')
    }
    
    if (genders.size === 1 && !genders.has('unknown')) {
      publishToEbay(productIds, Array.from(genders)[0])
      return
    }
    
    setGenderModal({ productIds })
  }


  // Pièces prévues = toutes les pièces postables, dans l'ordre du robot (plus chères
  // d'abord). Mêmes critères que /api/cron/sync-ebay-luxe?tous=1 : visible sur le site
  // (jamais une pièce masquée), reçue, sexe connu, photos suffisantes.
  const candidatsPrevus = useMemo(() =>
    [...pretes]
      .sort(ordreEbay)
      .map(p => ({
        id: p.id,
        nom: p.nom || '—',
        marque: p.marque || '',
        prix: p.prix ?? null,
        sku: p.sku || '',
        image: getMainImage(p),
      })),
  [pretes])

  // Une ligne de pièce (problèmes à gérer / en ligne)
  const ligne = (p: any) => {
          const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
          const mainImage = getMainImage(p)
          const isLuxury = getBrandPriority(p.marque) < 20
          const isPublished = !!p.ebayListingId
          const nbPhotos = compterPhotos(p)
          const sexe = resoudreSexe(p)
          const blocage = isPublished ? null : blocageEbay(p)

          return (
            <div
              key={p.id}
              className={`border rounded-lg p-3 flex gap-3 items-center ${
                isPublished ? 'bg-green-50 border-green-200' : 'bg-white'
              } ${isLuxury && !isPublished ? 'border-l-4 border-l-yellow-400' : ''}`}
            >
              {/* Photo */}
              <div className="w-14 h-14 flex-shrink-0">
                {mainImage ? (
                  <img src={mainImage} alt={p.nom} className="w-14 h-14 object-cover rounded" />
                ) : (
                  <div className="w-14 h-14 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">—</div>
                )}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{p.nom}</p>
                  {isLuxury && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-medium">LUXE</span>
                  )}
                  {p.madeIn && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{p.madeIn}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {p.marque || '—'} • {cat || '—'} • {p.taille || '—'}
                </p>
                {!isPublished && (
                  <p className="text-[11px] mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className={nbPhotos === 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>📷 {nbPhotos}</span>
                    <span className={!sexe ? 'text-red-600 font-medium' : 'text-gray-500'}>{sexe || 'sexe ?'}</span>
                    {blocage && (
                      <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-medium">⛔ {blocage}</span>
                    )}
                    {blocage?.startsWith('Sexe inconnu') && (
                      <>
                        <button onClick={() => choisirSexe(p.id, 'men')} className="px-2 py-0.5 rounded bg-blue-500 text-white font-bold hover:bg-blue-600">H</button>
                        <button onClick={() => choisirSexe(p.id, 'women')} className="px-2 py-0.5 rounded bg-pink-500 text-white font-bold hover:bg-pink-600">F</button>
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Prix */}
              <div className="text-right w-20">
                <p className="font-bold text-sm">{p.prix ? formatPrixEuro(p.prix) : '—'}</p>
                <p className="text-xs text-gray-400 font-mono">{p.sku || '—'}</p>
              </div>

              {isPublished && (
                <span className="w-20 text-right text-green-600 text-sm font-medium">✅ En ligne</span>
              )}
            </div>
          )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Calendrier : pièces prévues, file du robot, 4/jour espacées */}
      <EbayPostingCalendar candidats={candidatsPrevus} />

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-end bg-white border rounded-lg p-4">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Marque</label>
          <input
            type="text"
            placeholder="Filtrer..."
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Chineuse</label>
          <select
            value={filterChineuse}
            onChange={(e) => setFilterChineuse(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">Toutes</option>
            {trigrammes.map(tri => (
              <option key={tri} value={tri}>{tri}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Recherche</label>
          <input
            type="text"
            placeholder="Nom, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

      </div>

      {/* Problèmes à gérer : pièces luxe qui ne peuvent pas partir, avec la raison */}
      <div>
        <h2 className="font-bold text-sm mb-2">⛔ Problèmes à gérer ({bloquees.length})</h2>
        <div className="space-y-2">
          {[...bloquees].sort(ordreEbay).map(ligne)}
          {bloquees.length === 0 && <p className="text-center text-gray-400 py-4 text-sm">Aucun problème 🎉</p>}
        </div>
      </div>

      {/* En ligne sur eBay */}
      <div>
        <h2 className="font-bold text-sm mb-2">✅ En ligne sur eBay ({enLigne.length})</h2>
        <div className="space-y-2">
          {[...enLigne].sort(ordreEbay).map(ligne)}
          {enLigne.length === 0 && <p className="text-center text-gray-400 py-4 text-sm">Aucune pièce en ligne</p>}
        </div>
      </div>

      {/* Modal de sélection du genre */}
      {genderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-center">Genre du produit</h3>
            <div className="flex gap-3 justify-center mb-4">
              <button
                onClick={() => { publishToEbay(genderModal.productIds, 'Femme'); setGenderModal(null) }}
                className="border rounded px-4 py-2 bg-pink-500 text-white"
              >
                Femme
              </button>
              <button
                onClick={() => { publishToEbay(genderModal.productIds, 'Homme'); setGenderModal(null) }}
                className="border rounded px-4 py-2 bg-blue-500 text-white"
              >
                Homme
              </button>
              <button
                onClick={() => { publishToEbay(genderModal.productIds, 'Unisexe'); setGenderModal(null) }}
                className="border rounded px-4 py-2 bg-gray-500 text-white"
              >
                Unisexe
              </button>
            </div>
            <div className="text-center">
              <button
                onClick={() => setGenderModal(null)}
                className="text-gray-400 underline"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}