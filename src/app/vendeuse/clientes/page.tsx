// app/vendeuse/clientes/page.tsx
'use client'

import ClientsPanel from '@/components/ClientsPanel'

export default function VendeuseClientesPage() {
  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fichier Clientes</h1>
        <p className="text-gray-600 mt-1">Base de données clientes</p>
      </div>

      {/* Clientes */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <ClientsPanel />
      </div>
    </>
  )
}