// FXSignal service worker: shows push alerts, opens the app on click, and
// shows an offline page when there is no connection.
// Registered at startup so the installed app (and iPhone Home Screen app)
// always has it; a new version takes over straight away.

// Bump (v2, v3…) whenever this file changes, so old caches are dropped.
const CACHE = 'fxsignal-v1';
const OFFLINE_URL = '/offline.html';
const OFFLINE_ASSETS = [OFFLINE_URL, '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      // A failed download must not stop push from working.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// Pages always come from the network (signals must be live); the offline page
// only when the network fails. API calls and assets are not touched.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const offline = await caches.match(OFFLINE_URL);
      return (
        offline ??
        new Response('<h1>You are offline</h1><p>Reconnect and try again.</p>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      );
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'FXSignal', body: '', url: '/app' };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      // Android status-bar icon: white on transparent.
      badge: '/badge-96.png',
      data: { url: data.url },
      tag: data.title,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/app', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          // navigate() can reject on some mobile browsers; focusing still helps.
          return client
            .focus()
            .then((c) => (c && 'navigate' in c ? c.navigate(url) : c))
            .catch(() => self.clients.openWindow(url));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
