self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }

  const title = data.title || 'Work2Wish';
  const options = {
    body: data.body || 'You have a new Work2Wish update',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/', type: data.type || 'update', related_id: data.related_id || null },
    vibrate: [100, 50, 100],
    tag: data.type || 'work2wish-update',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
