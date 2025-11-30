// components/SyncVentesButton.tsx
'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

interface SyncVentesButtonProps {
  uid: string
  onSyncComplete?: () => void
  startDate?: string
  endDate?: string
  showDateFilters?: boolean
  className?: string
  buttonText?: string
}

export default function SyncVentesButton({
  uid,
  onSyncComplete,
  startDate: initialStartDate,
  endDate: initialEndDate,
  showDateFilters = false,
  className = '',
  buttonText = 'Recevoir de la caisse',
}: SyncVentesButtonProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [startDate, setStartDate] = useState(initialStartDate || '')
  const [endDate, setEndDate] = useState(initialEndDate || '')

  const handleSync = async () => {
    if (!uid) {
      setMessage('❌ UID manquant')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/sync-ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          startDateStr: startDate ? `${startDate}T00:00:00Z` : undefined,
          endDateStr: endDate ? `${endDate}T23:59:59Z` : undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessage(`✅ ${data.message || 'Synchronisation réussie !'}`)
        onSyncComplete?.()
      } else {
        setMessage(`❌ Erreur : ${data.error}`)
      }
    } catch (e: any) {
      setMessage(`❌ Erreur : ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      {showDateFilters && (
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
      )}

      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#22209C] text-white rounded hover:bg-[#1a1875] disabled:opacity-50 transition w-full"
      >
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Synchronisation...' : buttonText}
      </button>

      {message && (
        <p className={`text-sm mt-2 p-2 rounded ${message.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </p>
      )}
    </div>
  )
}