// app/vendeuse/commandes/page.tsx
'use client'

import CommandesPanel from '@/components/CommandesPanel'

export default function VendeuseCommandesPage() {
  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
        <p className="text-gray-600 mt-1">Gestion des commandes</p>
      </div>

      {/* Commandes */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <CommandesPanel mode="vendeuse" />
      </div>
    </>
  )
}