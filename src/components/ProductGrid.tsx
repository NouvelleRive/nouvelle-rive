// components/ProductGrid.tsx
'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import FavoriteButton from '@/components/FavoriteButton'
import { COLOR_PALETTE } from '@/lib/couleurs'
import { getModelesForCategorie } from '@/lib/modeles'
import { getMatieresForCategorie } from '@/lib/matieres'
import { MOTIFS } from '@/lib/motifs'
import { MACRO_ORDER, getMacroCategorie } from '@/lib/categories'

type Produit = {
  id: string
  nom: string
  prix: number
  imageUrls: string[]
  marque?: string
  taille?: string
  color?: string
  material?: string
  modele?: string
  motif?: string
  categorie?: any
  vendu: boolean
  promotion?: boolean
  createdAt?: any
}

interface ProductGridProps {
  produits: Produit[]
  columns?: 2 | 3 | 4
  showFilters?: boolean
}

function getCloudinaryUrl(url: string, size: number = 800): string {
  if (!url || !url.includes('cloudinary.com')) return url
  
  const transformations = [
    `w_${size}`,
    `h_${size}`,
    'c_fit',
    'q_auto:good',
    'f_auto',
  ].join(',')
  
  return url.replace('/upload/', `/upload/${transformations}/`)
}

export default function ProductGrid({ produits, columns = 3, showFilters = true }: ProductGridProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isTriOpen, setIsTriOpen] = useState(false)
  const triRef = useRef<HTMLDivElement>(null)
  
  const [filters, setFilters] = useState({
    promotion: false,
    marque: '',
    prixMin: '',
    prixMax: '',
    categorie: '',
    taille: '',
    color: '',
    material: '',
    modele: '',
    motif: '',
  })
  const [tri, setTri] = useState('nouveautes')

  const triLabels: { [key: string]: string } = {
    'nouveautes': 'Nouveautés',
    'prix-asc': 'Prix croissant',
    'prix-desc': 'Prix décroissant',
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (triRef.current && !triRef.current.contains(event.target as Node)) {
        setIsTriOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const categories = MACRO_ORDER.filter(macro =>
    produits.some(p => {
      const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      return label && getMacroCategorie(label) === macro
    })
  )

  const marques = [...new Set(produits.map(p => p.marque).filter(Boolean))].sort()

  // Produits filtrés par catégorie pour les sous-filtres
  const produitsParCat = filters.categorie
    ? produits.filter(p => {
        const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
        return label && getMacroCategorie(label) === filters.categorie
      })
    : produits

  const tailleOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'TAILLE UNIQUE']
  const tailles = [...new Set(produitsParCat.map(p => p.taille).filter(Boolean))].sort((a, b) => {
    const iA = tailleOrder.indexOf(a!.toUpperCase())
    const iB = tailleOrder.indexOf(b!.toUpperCase())
    if (iA !== -1 && iB !== -1) return iA - iB
    if (iA !== -1) return -1
    if (iB !== -1) return 1
    return a!.localeCompare(b!)
  })
  const couleurs = [...new Set(produitsParCat.map(p => p.color).filter(Boolean))].sort()

  // Matières et modèles depuis les libs si catégorie sélectionnée
  const categorieComplete = filters.categorie ? `X - ${filters.categorie}` : ''
  const matieresLib = categorieComplete ? getMatieresForCategorie(categorieComplete) : []
  const matieresPresentes = [...new Set(produitsParCat.map(p => p.material).filter(Boolean))] as string[]
  const matieres = matieresLib.length > 0
    ? matieresLib.filter(m => matieresPresentes.includes(m))
    : matieresPresentes.sort()

  const modelesLib = filters.categorie
    ? [...new Set(produitsParCat.flatMap(p => {
        const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
        return label ? getModelesForCategorie(label) : []
      }))]
    : []
  const modelesPresents = [...new Set(produitsParCat.map(p => p.modele).filter(Boolean))] as string[]
  const modeles = modelesLib.length > 0
    ? modelesLib.filter(m => modelesPresents.includes(m))
    : modelesPresents.sort()

    const motifsPresents = [...new Set(produitsParCat.map(p => p.motif).filter(Boolean))] as string[]
  const motifs = MOTIFS.filter(m => motifsPresents.includes(m))

  let filteredProduits = [...produits]

  if (filters.categorie) {
    filteredProduits = filteredProduits.filter(p => {
      const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      return label && getMacroCategorie(label) === filters.categorie
    })
  }
  
  if (filters.promotion) {
    filteredProduits = filteredProduits.filter(p => p.promotion)
  }
  if (filters.marque) {
    filteredProduits = filteredProduits.filter(p => p.marque === filters.marque)
  }
  if (filters.prixMin) {
    filteredProduits = filteredProduits.filter(p => p.prix >= Number(filters.prixMin))
  }
  if (filters.prixMax) {
    filteredProduits = filteredProduits.filter(p => p.prix <= Number(filters.prixMax))
  }
  if (filters.taille) {
    filteredProduits = filteredProduits.filter(p => p.taille === filters.taille)
  }
  if (filters.color) {
    filteredProduits = filteredProduits.filter(p => p.color === filters.color)
  }
  if (filters.material) {
    filteredProduits = filteredProduits.filter(p => p.material === filters.material)
  }

  if (filters.modele) {
    filteredProduits = filteredProduits.filter(p => p.modele === filters.modele)
  }

  if (filters.motif) {
    filteredProduits = filteredProduits.filter(p => p.motif === filters.motif)
  }

  if (tri === 'prix-asc') {
    filteredProduits.sort((a, b) => a.prix - b.prix)
  } else if (tri === 'prix-desc') {
    filteredProduits.sort((a, b) => b.prix - a.prix)
  } else if (tri === 'nouveautes') {
    filteredProduits.sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || 0
      const dateB = b.createdAt?.toMillis?.() || 0
      return dateB - dateA
    })
  }

  // Mobile: toujours 2 colonnes, Desktop: selon prop columns
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  }

  const resetFilters = () => {
    setFilters({
      promotion: false,
      marque: '',
      prixMin: '',
      prixMax: '',
      categorie: '',
      taille: '',
      color: '',
      material: '',
      modele: '',
      motif: '',
    })
  }

  return (
    <div>
      {/* Barre filtres/tri */}
      {showFilters && (
        <div 
          className="flex justify-between items-center py-4 px-4 md:px-6"
          style={{ borderBottom: '1px solid #000' }}
        >
          <button
            onClick={() => setIsFilterOpen(true)}
            className="uppercase text-xs tracking-widest hover:opacity-50 transition"
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            Filtrer +
          </button>
          
          <div className="relative" ref={triRef}>
            <button
              onClick={() => setIsTriOpen(!isTriOpen)}
              className="uppercase text-xs tracking-widest hover:opacity-50 transition flex items-center gap-2"
              style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
            >
              {triLabels[tri]}
              <span style={{ fontSize: '8px' }}>▼</span>
            </button>
            
            {isTriOpen && (
              <div 
                className="absolute right-0 top-full mt-2 bg-white min-w-[180px]"
                style={{ border: '1px solid #000', zIndex: 100 }}
              >
                {Object.entries(triLabels).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => { setTri(value); setIsTriOpen(false); }}
                    className="block w-full text-left px-4 py-3 uppercase text-xs tracking-widest hover:bg-gray-100 transition"
                    style={{ 
                      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                      fontWeight: tri === value ? '600' : '400',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grille produits */}
      <div className={`grid ${gridCols[columns]}`} style={{ borderLeft: '1px solid #000' }}>
        {filteredProduits.map((produit) => (
          <div
            key={produit.id}
            className="relative group"
            style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}
          >
            <Link 
              href={`/boutique/${produit.id}`}
              className="block"
            >
              <div className="aspect-square bg-white overflow-hidden">
              {produit.imageUrls?.[0] ? (
                <img
                  src={getCloudinaryUrl(produit.imageUrls[0])}
                  alt={produit.nom}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    Pas d'image
                  </div>
                )}
              </div>
              
              <div className="py-2 md:py-3 px-1 md:px-2 text-center bg-white">
                <h3 
                  className="uppercase font-semibold line-clamp-2"
                  style={{ 
                    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                    fontSize: '10px',
                    letterSpacing: '0.03em'
                  }}
                >
                  {produit.nom.replace(/^[A-Z]+\d+\s*[-–]\s*/i, '')}
                </h3>
                {produit.marque && (
                  <p 
                    className="mt-1 uppercase hidden md:block"
                    style={{ 
                      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                      fontSize: '10px',
                      letterSpacing: '0.05em',
                      color: '#666'
                    }}
                  >
                    {produit.marque}
                  </p>
                )}
                <p 
                  className="mt-1"
                  style={{ 
                    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                    fontSize: '11px',
                    color: '#000'
                  }}
                >
                  {produit.prix.toLocaleString('fr-FR')} €
                </p>
              </div>
            </Link>

            {/* Bouton Favori */}
            <div className="absolute top-1 right-1 md:top-2 md:right-2">
              <FavoriteButton productId={produit.id} size={20} className="md:!w-6 md:!h-6" />
            </div>
          </div>
        ))}
      </div>

      {/* Panel Filtres - PLEIN ÉCRAN - MOITIÉ DROITE */}
      {isFilterOpen && (
        <>
          {/* Overlay sombre sur la gauche */}
          <div 
            className="fixed inset-0 bg-black/20"
            style={{ zIndex: 99998 }}
            onClick={() => setIsFilterOpen(false)}
          />
          
          {/* Panel filtres - moitié droite */}
          <div 
            className="fixed top-0 right-0 bottom-0 w-full sm:w-1/2 bg-white flex flex-col"
            style={{ zIndex: 99999 }}
          >
            {/* Header */}
            <div 
              className="flex justify-between items-center p-6"
              style={{ borderBottom: '1px solid #000' }}
            >
              <span 
                className="uppercase text-sm tracking-widest font-semibold"
                style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
              >
                Filtre
              </span>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="w-10 h-10 relative hover:opacity-50 transition"
              >
                <span className="absolute top-1/2 left-0 w-full h-[1px] bg-black" style={{ transform: 'rotate(45deg)' }} />
                <span className="absolute top-1/2 left-0 w-full h-[1px] bg-black" style={{ transform: 'rotate(-45deg)' }} />
              </button>
            </div>

            {/* Filtres - scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Catégorie */}
              {categories.length > 0 && (
                <div className="px-6 py-6" style={{ borderBottom: '1px solid #000' }}>
                  <h4 
                    className="uppercase text-xs tracking-widest mb-4 font-semibold"
                    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  >
                    Catégorie
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setFilters({ ...filters, categorie: filters.categorie === cat ? '' : cat, taille: '', color: '', material: '', modele: '', motif: '' })}
                        className="py-2 px-3 text-xs uppercase tracking-wide transition"
                        style={{
                          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                          border: '1px solid #000',
                          backgroundColor: filters.categorie === cat ? '#000' : '#fff',
                          color: filters.categorie === cat ? '#fff' : '#000',
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Marque */}
              {marques.length > 0 && (
                <div className="px-6 py-6" style={{ borderBottom: '1px solid #000' }}>
                  <h4 
                    className="uppercase text-xs tracking-widest mb-4 font-semibold"
                    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  >
                    Marque
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {marques.map((marque) => (
                      <button
                        key={marque}
                        onClick={() => setFilters({ ...filters, marque: filters.marque === marque ? '' : marque! })}
                        className="py-2 px-3 text-xs uppercase tracking-wide transition"
                        style={{
                          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                          border: '1px solid #000',
                          backgroundColor: filters.marque === marque ? '#000' : '#fff',
                          color: filters.marque === marque ? '#fff' : '#000',
                        }}
                      >
                        {marque}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prix */}
              <div className="px-6 py-6" style={{ borderBottom: '1px solid #000' }}>
                <h4 
                  className="uppercase text-xs tracking-widest mb-4 font-semibold"
                  style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                >
                  Prix
                </h4>
                <div className="flex gap-4 items-center">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.prixMin}
                    onChange={(e) => setFilters({ ...filters, prixMin: e.target.value })}
                    className="w-24 py-2 px-3 text-sm"
                    style={{ 
                      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                      border: '1px solid #000'
                    }}
                  />
                  <span>—</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.prixMax}
                    onChange={(e) => setFilters({ ...filters, prixMax: e.target.value })}
                    className="w-24 py-2 px-3 text-sm"
                    style={{ 
                      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                      border: '1px solid #000'
                    }}
                  />
                  <span className="text-sm">€</span>
                </div>
              </div>

              {/* Taille */}
              <div className="px-6 py-6" style={{ borderBottom: '1px solid #000' }}>
                <h4 
                  className="uppercase text-xs tracking-widest mb-4 font-semibold"
                  style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                >
                  Taille
                </h4>
                {tailles.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {tailles.map((taille) => (
                      <button
                        key={taille}
                        onClick={() => setFilters({ ...filters, taille: filters.taille === taille ? '' : taille! })}
                        className="py-2 px-3 text-xs uppercase tracking-wide transition"
                        style={{
                          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                          border: '1px solid #000',
                          backgroundColor: filters.taille === taille ? '#000' : '#fff',
                          color: filters.taille === taille ? '#fff' : '#000',
                        }}
                      >
                        {taille}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p 
                    className="text-sm text-gray-500"
                    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  >
                    Aucune taille disponible
                  </p>
                )}
              </div>

              {/* Couleur */}
              {couleurs.length > 0 && (
                <div className="px-6 py-6" style={{ borderBottom: '1px solid #000' }}>
                  <h4 
                    className="uppercase text-xs tracking-widest mb-4 font-semibold"
                    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  >
                    Couleur
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {couleurs.map((couleur) => {
                      const paletteEntry = COLOR_PALETTE.find(c => c.name === couleur)
                      return (
                        <button
                          key={couleur}
                          onClick={() => setFilters({ ...filters, color: filters.color === couleur ? '' : couleur! })}
                          className="py-2 px-3 text-xs uppercase tracking-wide transition flex items-center gap-2"
                          style={{
                            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                            border: filters.color === couleur ? '2px solid #000' : '1px solid #000',
                            backgroundColor: filters.color === couleur ? '#f3f4f6' : '#fff',
                            color: '#000',
                          }}
                        >
                          <span 
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ 
                              background: paletteEntry?.hex || '#ccc',
                              border: couleur === 'Blanc' || couleur === 'Écru' || couleur === 'Crème' ? '1px solid #ccc' : 'none',
                            }}
                          />
                          {couleur}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Matière */}
              {matieres.length > 0 && (
                <div className="px-6 py-6" style={{ borderBottom: '1px solid #000' }}>
                  <h4 
                    className="uppercase text-xs tracking-widest mb-4 font-semibold"
                    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  >
                    Matière
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {matieres.map((matiere) => (
                      <button
                        key={matiere}
                        onClick={() => setFilters({ ...filters, material: filters.material === matiere ? '' : matiere! })}
                        className="py-2 px-3 text-xs uppercase tracking-wide transition"
                        style={{
                          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                          border: '1px solid #000',
                          backgroundColor: filters.material === matiere ? '#000' : '#fff',
                          color: filters.material === matiere ? '#fff' : '#000',
                        }}
                      >
                        {matiere}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Modèle */}
              {modeles.length > 0 && (
                <div className="px-6 py-6" style={{ borderBottom: '1px solid #000' }}>
                  <h4 
                    className="uppercase text-xs tracking-widest mb-4 font-semibold"
                    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  >
                    Modèle
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {modeles.map((modele) => (
                      <button
                        key={modele}
                        onClick={() => setFilters({ ...filters, modele: filters.modele === modele ? '' : modele })}
                        className="py-2 px-3 text-xs uppercase tracking-wide transition"
                        style={{
                          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                          border: '1px solid #000',
                          backgroundColor: filters.modele === modele ? '#000' : '#fff',
                          color: filters.modele === modele ? '#fff' : '#000',
                        }}
                      >
                        {modele}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Motif */}
              {motifs.length > 0 && (
                <div className="px-6 py-6" style={{ borderBottom: '1px solid #000' }}>
                  <h4 
                    className="uppercase text-xs tracking-widest mb-4 font-semibold"
                    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  >
                    Motif
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {motifs.map((motif) => (
                      <button
                        key={motif}
                        onClick={() => setFilters({ ...filters, motif: filters.motif === motif ? '' : motif })}
                        className="py-2 px-3 text-xs uppercase tracking-wide transition"
                        style={{
                          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                          border: '1px solid #000',
                          backgroundColor: filters.motif === motif ? '#000' : '#fff',
                          color: filters.motif === motif ? '#fff' : '#000',
                        }}
                      >
                        {motif}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Promotion */}
              <div className="px-6 py-6" style={{ borderBottom: '1px solid #000' }}>
                <h4 
                  className="uppercase text-xs tracking-widest mb-4 font-semibold"
                  style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                >
                  Promotion
                </h4>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div 
                    className="w-5 h-5 flex items-center justify-center"
                    style={{ border: '1px solid #000' }}
                    onClick={() => setFilters({ ...filters, promotion: !filters.promotion })}
                  >
                    {filters.promotion && <span className="text-sm">✓</span>}
                  </div>
                  <span 
                    className="text-sm uppercase tracking-wide"
                    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  >
                    En promotion uniquement
                  </span>
                </label>
              </div>
            </div>

            {/* Footer sticky */}
            <div 
              className="p-6 flex gap-4"
              style={{ borderTop: '1px solid #000' }}
            >
              <button
                onClick={resetFilters}
                className="flex-1 py-3 uppercase text-xs tracking-widest transition hover:opacity-50"
                style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  border: '1px solid #000',
                }}
              >
                Effacer
              </button>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="flex-1 py-3 uppercase text-xs tracking-widest text-white transition hover:opacity-80"
                style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  backgroundColor: '#000',
                }}
              >
                Appliquer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}