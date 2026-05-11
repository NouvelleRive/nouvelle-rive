'use client'

// Composant silencieux (sans UI) qui garantit qu'une subscription web push
// valide existe pour `ownerId` à chaque ouverture/réveil de la page.
//
// Stratégie "comme les autres apps" :
//   - À chaque mount, focus, visibilitychange → on vérifie la sub locale
//   - Si la permission est `granted` mais qu'il n'y a plus de sub (iOS l'a
//     révoquée silencieusement), on re-souscrit sans prompt et on renvoie
//     l'endpoint au serveur
//   - Combiné avec le handler `pushsubscriptionchange` du service worker
//     `/sw-push.js`, qui migre la sub côté serveur même si l'app n'est pas
//     ouverte au moment de la révocation.

import { useEffect } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}

export default function NotifsAutoSubscribe({ ownerId }: { ownerId: string | null | undefined }) {
  useEffect(() => {
    if (!ownerId) return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return

    let cancelled = false

    const ensureSubscribed = async () => {
      try {
        if (Notification.permission !== 'granted') return
        const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
        await navigator.serviceWorker.ready
        let sub = await reg.pushManager.getSubscription()
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
          })
        }
        if (cancelled) return
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerId, subscription: sub.toJSON() }),
        })
      } catch {
        // silencieux : pas d'UI à montrer ici
      }
    }

    ensureSubscribed()
    const onWake = () => ensureSubscribed()
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [ownerId])

  return null
}
