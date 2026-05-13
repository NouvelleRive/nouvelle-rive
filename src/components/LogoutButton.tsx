'use client'

// Bouton de déconnexion en icône "bonhomme" (User) — à placer dans les navbars
// de l'espace pro pour permettre de switcher de compte rapidement.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import { User as UserIcon } from 'lucide-react'

export default function LogoutButton({ size = 14 }: { size?: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const handle = async () => {
    if (busy) return
    if (!confirm('Se déconnecter ?')) return
    setBusy(true)
    try {
      await signOut(auth)
    } finally {
      router.replace('/login')
    }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      aria-label="Se déconnecter"
      title="Se déconnecter"
      className="text-xs text-gray-400 hover:text-[#22209C] border border-gray-200 rounded px-2 py-1 flex items-center gap-1 disabled:opacity-50"
    >
      <UserIcon size={size} />
    </button>
  )
}
