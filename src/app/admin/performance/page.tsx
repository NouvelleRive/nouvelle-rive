'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebaseConfig'
import { collection, onSnapshot } from 'firebase/firestore'
import PerformanceContent from '@/components/PerformanceContent'

type Deposant = {
  id: string
  nom?: string
  email: string
  trigramme?: string
}

export default function AdminPerformancePage() {
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [selectedTrigramme, setSelectedTrigramme] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'chineuse'), (snap) => {
      setDeposants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Deposant)))
    })
    return () => unsub()
  }, [])

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs font-medium text-gray-500">Je suis</label>
        <select
          value={selectedTrigramme}
          onChange={(e) => setSelectedTrigramme(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C]"
        >
          <option value="">Admin (vue globale)</option>
          {deposants.filter(d => d.trigramme).map(d => (
            <option key={d.id} value={d.trigramme}>{d.trigramme} — {d.nom || d.email}</option>
          ))}
        </select>
      </div>
      <PerformanceContent
        role={selectedTrigramme ? 'chineuse' : 'admin'}
        chineuseTrigramme={selectedTrigramme || undefined}
      />
    </div>
  )
}