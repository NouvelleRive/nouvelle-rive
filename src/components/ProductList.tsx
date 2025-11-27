// components/ProductList.tsx
'use client'

import { useState, useMemo } from 'react'
import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { 
  MoreHorizontal, Trash2, ChevronDown, ChevronUp, Sparkles, 
  Search, X, FileSpreadsheet, Download 
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// =====================
// TYPES
// =====================
export type Produit = {
  id: string
  nom: string
  description?: string
  categorie?: any
  prix?: number
  quantite?: number
  sku?: string
  marque?: string
  taille?: string
  material?: string
  color?: string
  madeIn?: string
  photos?: {
    face?: string
    faceOnModel?: string
    dos?: string
    details?: string[]
  }
  imageUrl?: string
  imageUrls?: string[]
  chineur?: string
  chineurUid?: string
  vendu?: boolean
  createdAt?: Timestamp
  dateVente?: Timestamp
  prixVenteReel?: number
  statut?: 'retour' | 'supprime' | 'vendu'
  dateRetour?: Timestamp | string
  photosReady?: boolean
  catalogObjectId?: string
  variationId?: string
  itemId?: string
  trigramme?: string
}

export type Deposant = {
  id: string
  email: string
  nom?: string
  trigramme?: string
}

interface ProductListProps {
  produits: Produit[]
  categories: string[]
  deposants?: Deposant[]
  isAdmin?: boolean
  showVentes?: boolean
  showFilters?: boolean
  showExport?: boolean
  showSelection?: boolean
  showActions?: boolean
  onEdit?: (produit: Produit) => void
  onDelete?: (id: string) => void
  onGenerateTryon?: (produit: Produit) => Promise<void>
  generatingTryonId?: string | null
}

// =====================
// TAILLES
// =====================
const TAILLES = {
  adulte: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'],
  enfant: ['0-3M', '3-6M', '6-12M', '12-18M', '18-24M', '2A', '3A', '4A', '5A', '6A', '8A', '10A', '12A', '14A', '16A'],
  chaussures: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  aucune: [],
}

type TypeTaille = keyof typeof TAILLES

function detectTypeTaille(categorie: string): TypeTaille {
  const cat = (categorie || '').toLowerCase()
  
  if (
    cat.includes('bague') || cat.includes('broche') || cat.includes('collier') || 
    cat.includes('bracelet') || cat.includes('boucle') || cat.includes('bijou') ||
    cat.includes('sac') || cat.includes('ceinture') || cat.includes('foulard') ||
    cat.includes('écharpe') || cat.includes('lunettes') || cat.includes('chapeau') ||
    cat.includes('bonnet') || cat.includes('gant') || cat.includes('montre') ||
    cat.includes('accessoire')
  ) {
    return 'aucune'
  }
  
  if (
    cat.includes('chaussure') || cat.includes('basket') || cat.includes('botte') ||
    cat.includes('bottine') || cat.includes('sandale') || cat.includes('escarpin') || 
    cat.includes('mocassin') || cat.includes('derby') || cat.includes('loafer') ||
    cat.includes('sneaker') || cat.includes('talon')
  ) {
    return 'chaussures'
  }
  
  if (cat.includes('enfant') || cat.includes('bébé') || cat.includes('bebe') || cat.includes('kid') || cat.includes('baby')) {
    return 'enfant'
  }
  
  return 'adulte'
}

function canUseFashnAI(categorie: string): boolean {
  const cat = (categorie || '').toLowerCase()
  if (
    cat.includes('bague') || cat.includes('boucle') || cat.includes('collier') || 
    cat.includes('bracelet') || cat.includes('broche') || cat.includes('chaussure') || 
    cat.includes('basket') || cat.includes('botte') || cat.includes('bottine') || 
    cat.includes('sandale') || cat.includes('escarpin') || cat.includes('mocassin') ||
    cat.includes('derby') || cat.includes('loafer') || cat.includes('sneaker') || 
    cat.includes('talon') || cat.includes('ceinture') || cat.includes('sac') || 
    cat.includes('foulard') || cat.includes('écharpe') || cat.includes('lunettes') || 
    cat.includes('chapeau') || cat.includes('bonnet') || cat.includes('gant') || 
    cat.includes('montre')
  ) {
    return false
  }
  return true
}

// =====================
// COMPONENT
// =====================
export default function ProductList({
  produits,
  categories,
  deposants = [],
  isAdmin = false,
  showVentes = false,
  showFilters = true,
  showExport = false,
  showSelection = false,
  showActions = true,
  onEdit,
  onDelete,
  onGenerateTryon,
  generatingTryonId,
}: ProductListProps) {
  // Filtres
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [filtreDeposant, setFiltreDeposant] = useState('')
  const [filtreMois, setFiltreMois] = useState('')

  // Sélection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Photos expandables
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Helpers
  const getChineurName = (email: string | undefined) => {
    if (!email) return '—'
    const dep = deposants.find((d) => d.email === email)
    return dep?.nom || email.split('@')[0]
  }

  const getAllImages = (p: Produit): string[] => {
    if (p.photos) {
      const imgs: string[] = []
      if (p.photos.face) imgs.push(p.photos.face)
      if (p.photos.faceOnModel) imgs.push(p.photos.faceOnModel)
      if (p.photos.dos) imgs.push(p.photos.dos)
      if (p.photos.details) imgs.push(...p.photos.details)
      return imgs
    }
    if (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) return p.imageUrls
    if (p.imageUrl) return [p.imageUrl]
    return []
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Filtrage
  const produitsFiltres = useMemo(() => {
    const needle = recherche.trim().toLowerCase()
    return produits.filter((p) => {
      // Exclure supprimés
      if (p.statut === 'supprime') return false

      // Mode ventes : seulement vendus
      if (showVentes) {
        if (!p.vendu && (p.quantite ?? 1) > 0) return false
      } else {
        // Mode produits : seulement actifs
        if (p.vendu || (p.quantite ?? 1) <= 0 || p.statut === 'retour') return false
      }

      // Filtre catégorie
      const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      if (filtreCategorie && cat !== filtreCategorie) return false

      // Filtre déposant
      if (filtreDeposant && p.chineur !== filtreDeposant) return false

      // Filtre mois
      if (filtreMois) {
        const dateField = showVentes ? p.dateVente : p.createdAt
        if (dateField instanceof Timestamp) {
          if (format(dateField.toDate(), 'yyyy-MM') !== filtreMois) return false
        } else {
          return false
        }
      }

      // Recherche texte
      if (needle) {
        const hay = [p.nom, p.sku, p.marque, p.taille, p.description, cat]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }

      return true
    })
  }, [produits, recherche, filtreCategorie, filtreDeposant, filtreMois, showVentes])

  // Produits récupérés (pour mode non-ventes)
  const produitsRecuperes = useMemo(() => {
    if (showVentes) return []
    return produits.filter((p) => p.statut === 'retour')
  }, [produits, showVentes])

  // Options de filtres
  const deposantsUniques = Array.from(new Set(produits.map((p) => p.chineur).filter(Boolean)))
  const categoriesUniques = categories.length > 0 
    ? categories 
    : Array.from(new Set(produits.map((p) => (typeof p.categorie === 'object' ? p.categorie?.label : p.categorie)).filter(Boolean)))
  
  const moisUniques = Array.from(
    new Set(
      produits
        .filter((p) => {
          const dateField = showVentes ? p.dateVente : p.createdAt
          return dateField instanceof Timestamp
        })
        .map((p) => {
          const dateField = showVentes ? p.dateVente : p.createdAt
          return format((dateField as Timestamp).toDate(), 'yyyy-MM')
        })
    )
  ).sort((a, b) => b.localeCompare(a))

  // Export
  const exportToExcel = () => {
    const data = produitsFiltres.map(p => ({
      SKU: p.sku || '',
      Nom: p.nom,
      Marque: p.marque || '',
      Taille: p.taille || '',
      Catégorie: typeof p.categorie === 'object' ? p.categorie?.label : p.categorie || '',
      'Prix (€)': showVentes ? (p.prixVenteReel ?? p.prix) : p.prix || '',
      Quantité: p.quantite || '',
      Chineuse: getChineurName(p.chineur),
      Date: (() => {
        const dateField = showVentes ? p.dateVente : p.createdAt
        return dateField instanceof Timestamp ? format(dateField.toDate(), 'dd/MM/yyyy') : ''
      })(),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, showVentes ? 'Ventes' : 'Produits')
    XLSX.writeFile(wb, `${showVentes ? 'ventes' : 'produits'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const exportToPDF = () => {
    const pdfDoc = new jsPDF()
    const title = showVentes ? 'Ventes' : 'Produits'
    pdfDoc.setFontSize(18)
    pdfDoc.setTextColor(34, 32, 156)
    pdfDoc.text(title, 14, 20)
    pdfDoc.setFontSize(10)
    pdfDoc.setTextColor(100)
    pdfDoc.text(`Exporté le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}`, 14, 28)
    autoTable(pdfDoc, {
      startY: 35,
      head: [['SKU', 'Nom', 'Marque', 'Taille', 'Catégorie', 'Prix', 'Qté', 'Chineuse']],
      body: produitsFiltres.map(p => [
        p.sku || '—',
        (p.nom || '').substring(0, 25),
        p.marque || '—',
        p.taille || '—',
        ((typeof p.categorie === 'object' ? p.categorie?.label : p.categorie) || '').substring(0, 15) || '—',
        typeof p.prix === 'number' ? `${showVentes ? (p.prixVenteReel ?? p.prix) : p.prix} €` : '—',
        p.quantite ?? 1,
        getChineurName(p.chineur)?.substring(0, 12) || '—'
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 32, 156] }
    })
    pdfDoc.save(`${showVentes ? 'ventes' : 'produits'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  const resetFilters = () => {
    setRecherche('')
    setFiltreCategorie('')
    setFiltreDeposant('')
    setFiltreMois('')
  }

  const hasActiveFilters = recherche || filtreCategorie || filtreDeposant || filtreMois

  return (
    <div className="space-y-4">
      {/* Filtres */}
      {showFilters && (
        <div className="bg-white rounded border p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Recherche */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Recherche..."
                className="w-full pl-10 pr-4 py-2 border rounded text-sm"
              />
            </div>

            {/* Filtre chineuse (admin only) */}
            {isAdmin && (
              <select
                value={filtreDeposant}
                onChange={(e) => setFiltreDeposant(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">Toutes chineuses</option>
                {deposantsUniques.map((email, i) => (
                  <option key={i} value={email}>{getChineurName(email)}</option>
                ))}
              </select>
            )}

            {/* Filtre catégorie */}
            <select
              value={filtreCategorie}
              onChange={(e) => setFiltreCategorie(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">Toutes catégories</option>
              {categoriesUniques.map((c, i) => (
                <option key={i} value={c as string}>{c}</option>
              ))}
            </select>

            {/* Filtre mois */}
            <select
              value={filtreMois}
              onChange={(e) => setFiltreMois(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="">Tous mois</option>
              {moisUniques.map((m) => (
                <option key={m} value={m}>{format(new Date(m + '-01'), 'MMM yyyy', { locale: fr })}</option>
              ))}
            </select>
          </div>

          {/* Compteur et actions */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {produitsFiltres.length} {showVentes ? 'vente(s)' : 'produit(s)'}
            </span>
            <div className="flex gap-2">
              {hasActiveFilters && (
                <button onClick={resetFilters} className="text-sm text-[#22209C] flex items-center gap-1">
                  <X size={14} /> Reset
                </button>
              )}
              {showExport && (
                <>
                  <button onClick={exportToExcel} className="px-3 py-1 bg-green-600 text-white rounded text-sm flex items-center gap-1">
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button onClick={exportToPDF} className="px-3 py-1 bg-red-600 text-white rounded text-sm flex items-center gap-1">
                    <Download size={14} /> PDF
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Liste produits */}
      <div className="space-y-3">
        {produitsFiltres.map((p) => {
          const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
          const allImages = getAllImages(p)
          const isExpanded = expandedIds.has(p.id)
          const displayImages = isExpanded ? allImages : allImages.slice(0, 3)
          const hasMoreImages = allImages.length > 3

          const canGenerateTryon = canUseFashnAI(cat || '') && 
            (p.photos?.face || allImages[0]) && 
            !p.photos?.faceOnModel

          return (
            <div
              key={p.id}
              className={`border rounded-lg p-3 shadow-sm bg-white flex gap-4 items-start ${
                showVentes ? 'border-l-4 border-l-green-500' : ''
              }`}
            >
              {/* Checkbox */}
              {showSelection && (
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelection(p.id)}
                  />
                </div>
              )}

              {/* Photos */}
              <div className="flex-shrink-0">
                <div className="flex gap-2 items-center flex-wrap">
                  {displayImages.length > 0 ? (
                    displayImages.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`${p.nom} ${idx + 1}`}
                        className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                        onClick={() => window.open(url, '_blank')}
                        title="Cliquer pour agrandir"
                      />
                    ))
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                      Ø
                    </div>
                  )}

                  {hasMoreImages && !isExpanded && (
                    <button
                      onClick={() => toggleExpanded(p.id)}
                      className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-600 text-sm hover:bg-gray-200 transition"
                      title="Voir toutes les photos"
                    >
                      +{allImages.length - 3}
                    </button>
                  )}
                </div>

                {isExpanded && allImages.length > 3 && (
                  <button
                    onClick={() => toggleExpanded(p.id)}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                  >
                    <ChevronUp size={14} /> Réduire
                  </button>
                )}
              </div>

              {/* Nom / Description / Date */}
              <div className="flex-1 min-w-[180px]">
                <p className="font-semibold text-sm">{p.nom}</p>
                {p.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {isAdmin && <span className="text-gray-600">{getChineurName(p.chineur)} • </span>}
                  {(() => {
                    const dateField = showVentes ? p.dateVente : p.createdAt
                    return dateField instanceof Timestamp
                      ? format(dateField.toDate(), 'dd/MM/yyyy')
                      : '—'
                  })()}
                </p>
              </div>

              {/* Catégorie / Marque / Taille */}
              <div className="w-32 text-xs space-y-1 hidden md:block">
                <p><span className="text-gray-500">Cat:</span> {cat ?? '—'}</p>
                <p><span className="text-gray-500">Marque:</span> {p.marque ?? '—'}</p>
                <p><span className="text-gray-500">Taille:</span> {p.taille ?? '—'}</p>
                {p.material && <p><span className="text-gray-500">Matière:</span> {p.material}</p>}
                {p.color && <p><span className="text-gray-500">Couleur:</span> {p.color}</p>}
              </div>

              {/* SKU / Prix / Quantité */}
              <div className="w-28 text-xs space-y-1">
                <p><span className="text-gray-500">SKU:</span> {p.sku ?? '—'}</p>
                <p className={showVentes ? 'font-bold text-green-600' : ''}>
                  <span className="text-gray-500">Prix:</span>{' '}
                  {typeof p.prix === 'number' ? `${showVentes ? (p.prixVenteReel ?? p.prix) : p.prix} €` : '—'}
                </p>
                {!showVentes && <p><span className="text-gray-500">Qté:</span> {p.quantite ?? 1}</p>}
              </div>

              {/* Actions */}
              {showActions && (
                <div className="flex gap-1">
                  {/* Bouton génération IA */}
                  {canGenerateTryon && onGenerateTryon && (
                    <button
                      onClick={() => onGenerateTryon(p)}
                      disabled={generatingTryonId === p.id}
                      className="p-1 text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50 transition"
                      title="Générer photo portée avec IA"
                    >
                      {generatingTryonId === p.id ? (
                        <span className="text-xs animate-pulse">⏳</span>
                      ) : (
                        <Sparkles size={18} />
                      )}
                    </button>
                  )}

                  {/* Modifier */}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(p)}
                      className="p-1 text-gray-500 hover:text-black hover:bg-gray-100 rounded"
                      title="Modifier"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  )}

                  {/* Supprimer */}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(p.id)}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {produitsFiltres.length === 0 && (
        <p className="text-center text-gray-400 py-8">
          {showVentes ? 'Aucune vente' : 'Aucun produit'}
        </p>
      )}

      {/* Produits récupérés */}
      {!showVentes && produitsRecuperes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-600">Produits récupérés</h3>
          <div className="space-y-3 opacity-70">
            {produitsRecuperes.map((p) => {
              const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
              const allImages = getAllImages(p)
              const retourDate =
                p.dateRetour instanceof Timestamp
                  ? p.dateRetour.toDate()
                  : p.dateRetour
                  ? new Date(p.dateRetour as any)
                  : null

              return (
                <div
                  key={p.id}
                  className="border rounded-lg p-3 shadow-sm bg-gray-50 flex gap-4 items-start"
                >
                  {showSelection && <div className="w-5" />}

                  {/* Photo */}
                  <div className="w-16 h-16 flex-shrink-0">
                    {allImages.length > 0 ? (
                      <img src={allImages[0]} alt={p.nom} className="w-16 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                        —
                      </div>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-semibold text-sm">{p.nom}</p>
                    {p.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                    <p className="text-xs text-amber-600 mt-1">
                      Récupéré le {retourDate ? format(retourDate, 'dd/MM/yyyy') : '—'}
                    </p>
                  </div>

                  {/* Catégorie / Marque / Taille */}
                  <div className="w-32 text-xs space-y-1 hidden md:block">
                    <p><span className="text-gray-500">Cat:</span> {cat ?? '—'}</p>
                    <p><span className="text-gray-500">Marque:</span> {p.marque ?? '—'}</p>
                    <p><span className="text-gray-500">Taille:</span> {p.taille ?? '—'}</p>
                  </div>

                  {/* SKU / Prix */}
                  <div className="w-28 text-xs space-y-1">
                    <p><span className="text-gray-500">SKU:</span> {p.sku ?? '—'}</p>
                    <p><span className="text-gray-500">Prix:</span> {typeof p.prix === 'number' ? `${p.prix} €` : '—'}</p>
                  </div>

                  <div className="w-12" />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}