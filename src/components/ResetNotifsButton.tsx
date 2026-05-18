'use client'

// Bouton qui force un re-abonnement propre aux notifs push, puis envoie un
// push de test immédiat pour vérifier que la livraison arrive bien sur le
// device. Utile quand l'auto-resubscribe silencieux ne suffit pas (sub
// fantôme côté Apple/Google : l'endpoint répond 201 sans livrer).

import { useState } from 'react'
import { Bell, Check, X } from 'lucide-react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}

export default function ResetNotifsButton({ ownerId }: { ownerId: string }) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'err'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const run = async () => {
    if (status === 'busy') return
    setStatus('busy')
    setErrMsg('')
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Notifs non supportées par ce navigateur')
      }
      if (Notification.permission !== 'granted') {
        const p = await Notification.requestPermission()
        if (p !== 'granted') throw new Error('Permission refusée')
      }
      const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
      await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        try { await existing.unsubscribe() } catch {}
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
      })
      const subRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId, subscription: sub.toJSON() }),
      })
      const subData = await subRes.json()
      if (!subData.success) throw new Error(subData.error || 'subscribe failed')
      await fetch(`/api/push/test?owner=${encodeURIComponent(ownerId)}`)
      setStatus('done')
      setTimeout(() => setStatus('idle'), 4000)
    } catch (e: any) {
      console.error('Reset notifs failed:', e)
      setErrMsg(e?.message || 'Erreur')
      setStatus('err')
      setTimeout(() => setStatus('idle'), 6000)
    }
  }

  return (
    <button
      onClick={run}
      disabled={status === 'busy'}
      aria-label="Reset notifications"
      title={errMsg ? `Erreur : ${errMsg}` : 'Reset notifications (test push immédiat)'}
      className="text-xs text-gray-400 hover:text-[#22209C] border border-gray-200 rounded px-2 py-1 flex items-center gap-1 disabled:opacity-50"
    >
      {status === 'done' ? <Check size={14} className="text-green-600" /> :
       status === 'err' ? <X size={14} className="text-red-500" /> :
       <Bell size={14} />}
    </button>
  )
}
