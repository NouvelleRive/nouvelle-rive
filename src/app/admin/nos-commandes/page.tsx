// app/admin/commandes/page.tsx
'use client'

import { useAdmin } from '@/lib/admin/context'
import CommandesPanel from '@/components/CommandesPanel'

export default function AdminCommandesPage() {
  const { selectedChineuse, produitsFiltres, loading } = useAdmin()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <div className="bg-white border rounded p-6">
      <CommandesPanel 
        mode="admin" 
        vendeuseEmail={selectedChineuse?.email}
        filterProduitIds={selectedChineuse ? produitsFiltres.map(p => p.id) : undefined}
      />
    </div>
  )
}