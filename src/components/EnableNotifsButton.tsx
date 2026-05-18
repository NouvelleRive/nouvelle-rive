'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}

export default function EnableNotifsButton({
  ownerId,
  label = 'Activer les notifications',
}: {
  ownerId: string
  label?: string
}) {
  const [status, setStatus] = useState<'idle' | 'unsupported' | 'denied' | 'subscribed' | 'subscribing'>('idle')

  // Inscription effective (avec ou sans demande de permission selon contexte)
  const subscribe = async (askPermission: boolean): Promise<boolean> => {
    if (askPermission) {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'idle')
        return false
      }
    } else if (Notification.permission !== 'granted') {
      return false
    }
    const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
    await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
    })
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, subscription: sub.toJSON() }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'erreur')
    setStatus('subscribed')
    return true
  }

  // Vérifie l'état + auto-resubscribe si permission granted mais sub manquante
  const checkAndResubscribe = async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return }
    if (Notification.permission !== 'granted') return
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw-push.js')
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        setStatus('subscribed')
        return
      }
      // Permission accordée mais sub disparue (iOS silently invalide) → re-subscribe sans prompt
      await subscribe(false)
    } catch (e) {
      console.warn('checkAndResubscribe failed:', e)
    }
  }

  useEffect(() => {
    checkAndResubscribe()
    const onFocus = () => checkAndResubscribe()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId])

  const enable = async () => {
    if (status === 'subscribed' || status === 'subscribing') return
    setStatus('subscribing')
    try {
      await subscribe(true)
    } catch (e: any) {
      console.error(e)
      alert('Impossible d\'activer les notifs : ' + (e?.message || 'erreur'))
      setStatus('idle')
    }
  }

  if (status === 'unsupported') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <BellOff size={14} /> Notifs non supportées (installe l'app sur l'écran d'accueil)
      </div>
    )
  }
  if (status === 'denied') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-500">
        <BellOff size={14} /> Notifs refusées (vérifie les réglages iOS)
      </div>
    )
  }
  if (status === 'subscribed') {
    return null
  }
  return (
    <button
      onClick={enable}
      disabled={status === 'subscribing'}
      className="flex items-center gap-2 text-xs text-[#22209C] border border-[#22209C] rounded px-3 py-1.5 hover:bg-[#22209C] hover:text-white disabled:opacity-50"
    >
      <Bell size={14} /> {status === 'subscribing' ? '…' : label}
    </button>
  )
}
