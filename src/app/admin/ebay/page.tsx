// app/admin/ebay/page.tsx
'use client'

import { useState, useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { getBrandPriority } from '@/lib/admin/helpers'

export default function AdminEbayPage() {
  const { produitsFiltres, loadData, loading } = useAdmin()
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [publishing, setPublishing] = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [filterBrand, setFilterBrand] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'not_published'>('not_published')
  const [search, setSearch] = useState('')

  // Filtrer les produits actifs
  const produitsActifs = produitsFiltres.filter(p => 
    (p.quantite ?? 1) > 0 && 
    p.statut !== 'vendu' && 
    p.statut !== 'supprime'
  )

  // Produits filtrés et triés
  const produitsEbay = useMemo(() => {
    let result = [...produitsActifs]

    if (filterStatus === 'published') {
      result = result.filter(p => p.ebayListingId)
    } else if (filterStatus === 'not_published') {
      result = result.filter(p => !p.ebayListingId)
    }

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

    // Tri : luxe en premier, puis par prix décroissant
    result.sort((a, b) => {
      const priorityA = getBrandPriority(a.marque)
      const priorityB = getBrandPriority(b.marque)
      if (priorityA !== priorityB) return priorityA - priorityB
      return (b.prix ?? 0) - (a.prix ?? 0)
    })

    return result
  }, [produitsActifs, filterStatus, filterBrand, search])

  const getMainImage = (p: any): string | null => {
    if (p.photos?.face) return p.photos.face
    if (p.photos?.faceOnModel) return p.photos.faceOnModel
    if (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) return p.imageUrls[0]
    if (p.imageUrl) return p.imageUrl
    return null
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const notPublishedCount = produitsEbay.filter(p => !p.ebayListingId).length

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(produitsEbay.filter(p => !p.ebayListingId).map(p => p.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const publishToEbay = async (productIds: string[]) => {
    if (productIds.length === 0) return
    if (!confirm(productIds.length === 1 ? 'Publier ce produit sur eBay ?' : `Publier ${productIds.length} produits sur eBay ?`)) return

    setPublishing(true)
    try {
      const res = await fetch('/api/ebay/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds })
      })
      const data = await res.json()
      if (data.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || productIds.length
        alert(`✅ ${successCount} produit(s) publié(s) sur eBay !`)
        await loadData()
      } else {
        alert(`❌ Erreur : ${data.error || 'Erreur inconnue'}`)
      }
    } catch (err: any) {
      alert(`❌ Erreur réseau : ${err.message}`)
    } finally {
      setPublishing(false)
      setSelectedIds(new Set())
      setPublishingId(null)
    }
  }

  // Stats
  const publishedCount = produitsActifs.filter(p => p.ebayListingId).length
  const totalCount = produitsActifs.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">{publishedCount}</p>
          <p className="text-sm text-gray-600">Publiés sur eBay</p>
        </div>
        <div className="bg-gray-50 border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-gray-600">{totalCount - publishedCount}</p>
          <p className="text-sm text-gray-600">En attente</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{totalCount}</p>
          <p className="text-sm text-gray-600">Total actifs</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-end bg-white border rounded-lg p-4">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Statut eBay</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="not_published">Non publiés</option>
            <option value="published">Publiés</option>
            <option value="all">Tous</option>
          </select>
        </div>

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

        {selectedIds.size > 0 && (
          <button
            onClick={() => publishToEbay(Array.from(selectedIds))}
            disabled={publishing}
            className="px-4 py-2 bg-yellow-500 text-white rounded font-medium hover:bg-yellow-600 disabled:opacity-50 text-sm"
          >
            {publishing ? '⏳ Publication...' : `🚀 Publier (${selectedIds.size})`}
          </button>
        )}
      </div>

      {/* Sélection globale */}
      {filterStatus !== 'published' && notPublishedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={selectedIds.size === notPublishedCount}
            onChange={(e) => toggleAll(e.target.checked)}
            className="accent-yellow-500"
          />
          <span>Tout sélectionner ({selectedIds.size}/{notPublishedCount})</span>
        </div>
      )}

      {/* Liste des produits */}
      <div className="space-y-2">
        {produitsEbay.map((p) => {
          const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
          const mainImage = getMainImage(p)
          const isLuxury = getBrandPriority(p.marque) < 20
          const isPublished = !!p.ebayListingId

          return (
            <div
              key={p.id}
              className={`border rounded-lg p-3 flex gap-3 items-center ${
                isPublished ? 'bg-green-50 border-green-200' : 'bg-white'
              } ${isLuxury && !isPublished ? 'border-l-4 border-l-yellow-400' : ''}`}
            >
              {/* Checkbox */}
              {!isPublished && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleSelection(p.id)}
                  className="accent-yellow-500"
                />
              )}

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
              </div>

              {/* Prix */}
              <div className="text-right w-20">
                <p className="font-bold text-sm">{p.prix ? `${p.prix}€` : '—'}</p>
                <p className="text-xs text-gray-400 font-mono">{p.sku || '—'}</p>
              </div>

              {/* Action */}
              <div className="w-24 text-right">
                {isPublished ? (
                  <span className="text-green-600 text-sm font-medium">✅ Publié</span>
                ) : (
                  <button
                    onClick={() => { setPublishingId(p.id); publishToEbay([p.id]) }}
                    disabled={publishing || publishingId === p.id}
                    className="px-3 py-1.5 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600 disabled:opacity-50"
                  >
                    {publishingId === p.id ? '⏳' : '🚀 Publier'}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {produitsEbay.length === 0 && (
          <p className="text-center text-gray-400 py-8">Aucun produit trouvé</p>
        )}
      </div>
    </div>
  )
}