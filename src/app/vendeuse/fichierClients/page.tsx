// app/vendeuse/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import CommandesPanel from '@/components/CommandesPanel'
import ClientsPanel from '@/components/ClientsPanel'
import { Package, Users } from 'lucide-react'

export default function VendeusePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'commandes' | 'clients'>('commandes')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push('/login')
      } else {
        setUser(u)
        setLoading(false)
      }
    })
    return () => unsub()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <h1 className="text-2xl font-bold text-gray-900">🏪 Espace Vendeuse</h1>
            <p className="text-gray-600 mt-1">Gestion des commandes et clients</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="flex gap-1 border-b">
            {[
              { key: 'commandes', icon: Package, label: 'Commandes' },
              { key: 'clients', icon: Users, label: 'Clients' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-3 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'border-b-2 border-[#22209C] text-[#22209C]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          {activeTab === 'commandes' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <CommandesPanel mode="vendeuse" compact={false} />
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <ClientsPanel />
            </div>
          )}
        </div>
      </main>
    </>
  )
}