// FXSignal service worker: shows push alerts and opens the app on click.
// Registered at startup so the installed app (and iPhone Home Screen app)
// always has it; a new version takes over straight away.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
