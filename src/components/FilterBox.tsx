// components/FilterBox.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react'

export interface FilterOption {
  value: string
  label: string
}

const TRI_OPTIONS: FilterOption[] = [
  { value: 'date-desc', label: 'Date ↓' },
  { value: 'date-asc', label: 'Date ↑' },
  { value: 'alpha', label: 'A → Z' },
  { value: 'prix-asc', label: 'Prix ↑' },
  { value: 'prix-desc', label: 'Prix ↓' },
]

export interface FilterConfig {
  recherche?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  mois?: {
    value: string
    onChange: (value: string) => void
    options: FilterOption[]
  }
  chineuse?: {
    value: string
    onChange: (value: string) => void
    options: FilterOption[]
  }
  categorie?: {
    value: string
    onChange: (value: string) => void
    options: FilterOption[]
  }
  prix?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  tri?: {
    value: string
    onChange: (value: string) => void
  }
  statut?: {
    value: string
    onChange: (value: string) => void
    options: FilterOption[]
  }
}

interface FilterBoxProps {
  filters: FilterConfig
  onReset?: () => void
  hasActiveFilters?: boolean
  className?: string
}

export default function FilterBox({
  filters,
  onReset,
  hasActiveFilters = false,
  className = '',
}: FilterBoxProps) {
  const [showFilters, setShowFilters] = useState(false)

  const activeFilterCount = [
    filters.mois,
    filters.chineuse,
    filters.categorie,
    filters.prix,
    filters.tri,
    filters.statut,
  ].filter(Boolean).length

  const getGridCols = () => {
    if (activeFilterCount <= 2) return 'lg:grid-cols-2'
    if (activeFilterCount <= 3) return 'lg:grid-cols-3'
    return 'lg:grid-cols-4'
  }

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm ${className}`}>
      {/* Header mobile */}
      <div
        className="lg:hidden flex items-center justify-between w-full mb-2 cursor-pointer"
        onClick={() => setShowFilters(!showFilters)}
      >
        <h2 className="text-lg font-semibold">Filtrer</h2>
        {showFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>
      
      {/* Header desktop */}
      <div className="hidden lg:flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Filtrer</h2>
        {hasActiveFilters && onReset && (
          <button
            onClick={onReset}
            className="text-sm text-[#22209C] flex items-center gap-1 hover:underline"
          >
            <X size={14} /> Réinitialiser
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className={`${showFilters ? 'block' : 'hidden'} lg:block space-y-4`}>
        
        {/* Recherche */}
        {filters.recherche && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filters.recherche.value}
              onChange={(e) => filters.recherche!.onChange(e.target.value)}
              placeholder={filters.recherche.placeholder || 'Rechercher...'}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>
        )}

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${getGridCols()} gap-3`}>
          
          {/* Mois */}
          {filters.mois && (
            <div>
              <label className="block text-sm font-medium mb-1">Mois</label>
              <select
                value={filters.mois.value}
                onChange={(e) => filters.mois!.onChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {filters.mois.options.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Chineuse */}
          {filters.chineuse && (
            <div>
              <label className="block text-sm font-medium mb-1">Chineuse</label>
              <select
                value={filters.chineuse.value}
                onChange={(e) => filters.chineuse!.onChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Toutes</option>
                {filters.chineuse.options.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Catégorie */}
          {filters.categorie && (
            <div>
              <label className="block text-sm font-medium mb-1">Catégorie</label>
              <select
                value={filters.categorie.value}
                onChange={(e) => filters.categorie!.onChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Toutes</option>
                {filters.categorie.options.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Prix */}
          {filters.prix && (
            <div>
              <label className="block text-sm font-medium mb-1">Prix</label>
              <input
                type="text"
                value={filters.prix.value}
                onChange={(e) => filters.prix!.onChange(e.target.value)}
                placeholder={filters.prix.placeholder || 'Ex: 95'}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {/* Tri */}
          {filters.tri && (
            <div>
              <label className="block text-sm font-medium mb-1">Trier par</label>
              <select
                value={filters.tri.value}
                onChange={(e) => filters.tri!.onChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {TRI_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Statut */}
          {filters.statut && (
            <div>
              <label className="block text-sm font-medium mb-1">Statut</label>
              <select
                value={filters.statut.value}
                onChange={(e) => filters.statut!.onChange(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {filters.statut.options.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Bouton reset mobile */}
        {hasActiveFilters && onReset && (
          <button
            onClick={onReset}
            className="lg:hidden text-sm text-[#22209C] flex items-center gap-1"
          >
            <X size={14} /> Réinitialiser les filtres
          </button>
        )}
      </div>
    </div>
  )
}