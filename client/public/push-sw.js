// This file is strictly imported into the Vite PWA generated Service Worker via importScripts.
// It handles ONLY background push events and notification clicks.

self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const title = data.title || 'New Notification';
    const options = {
      body: data.body || '',
      icon: '/icon-192x192.png',
      badge: '/icon-maskable-512x512.png',
      tag: data.tag || data.metadata?.idempotencyKey,
      data: {
        url: data.actionUrl || '/'
      }
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error('Error processing push event:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  let targetUrl = event.notification.data.url || "/";

  try {
    const parsed = new URL(targetUrl, self.location.origin);
    if (parsed.origin !== self.location.origin) {
      targetUrl = '/';
    }
  } catch (error) {
    targetUrl = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If a window is already open, focus it and navigate
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
