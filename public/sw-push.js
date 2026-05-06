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
