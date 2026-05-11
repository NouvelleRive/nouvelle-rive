// Service worker dédié aux notifications push web
// Reçoit les pushs depuis le serveur et affiche une notification système.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Nouvelle Rive', body: event.data?.text?.() || '' } }
  const title = data.title || 'Nouvelle Rive'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-96.png',
    image: data.image,
    data: { url: data.url || '/' },
    tag: data.tag,
    renotify: !!data.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if (c.url.includes(url) && 'focus' in c) return c.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})

// Quand iOS/le navigateur révoque/renouvelle la subscription, on re-souscrit
// automatiquement en arrière-plan et on envoie le nouvel endpoint au serveur
// qui migre l'ancien doc Firestore vers le nouveau.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const oldEndpoint = event.oldSubscription?.endpoint || null
      const options = event.oldSubscription?.options || event.newSubscription?.options
      let newSub = event.newSubscription
      if (!newSub && options) {
        newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: options.applicationServerKey,
        })
      }
      if (!newSub) return
      await fetch('/api/push/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldEndpoint,
          subscription: newSub.toJSON(),
        }),
      })
    } catch (e) {
      // best-effort, le client re-souscrira à la prochaine ouverture
    }
  })())
})
