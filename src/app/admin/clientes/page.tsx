// app/admin/clients/page.tsx
'use client'

import { useAdmin } from '@/lib/admin/context'
import ClientsPanel from '@/components/ClientsPanel'

export default function AdminClientsPage() {
  const { loading } = useAdmin()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <div className="bg-white border rounded p-6">
      <ClientsPanel />
    </div>
  )
}