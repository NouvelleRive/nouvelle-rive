// app/admin/ventes/page.tsx
'use client'

import { useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import ProductList from '@/components/ProductList'

export default function AdminVentesPage() {
  const { selectedChineuse, produitsFiltres, deposants, loading } = useAdmin()

  // Catégories uniques
  const categoriesUniques = useMemo(() => {
    return Array.from(new Set(
      produitsFiltres.map((p) => (typeof p.categorie === 'object' ? p.categorie?.label : p.categorie)).filter(Boolean)
    )) as string[]
  }, [produitsFiltres])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <ProductList
      produits={produitsFiltres}
      categories={categoriesUniques}
      deposants={deposants}
      isAdmin={!selectedChineuse}
      showVentes={true}
      showFilters={true}
      showExport={true}
      showSelection={false}
      showActions={false}
    />
  )
}