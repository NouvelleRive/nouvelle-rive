// app/vendeuse/commandes/page.tsx
'use client'

import CommandesPanel from '@/components/CommandesPanel'

export default function VendeuseCommandesPage() {
  return (
    <>
      {/* Header — même display que la page Produits */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-[#22209C] text-center uppercase">Commandes</h1>
      </div>

      {/* Commandes */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <CommandesPanel mode="vendeuse" />
      </div>
    </>
  )
}