
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

// --- 1. Standard PWA Update Logic ---
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
self.skipWaiting()
clientsClaim()

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// --- 2. Push Notification Logic ---
self.addEventListener('push', function(event) {
  if (event.data) {
    let data;
    try {
        data = event.data.json();
    } catch(e) {
        console.error('Push data parse error', e);
        // Fallback if not JSON
        data = { title: 'FHB Maintain', body: event.data.text() };
    }

    const options = {
      body: data.body,
      icon: 'https://cdn-icons-png.flaticon.com/512/993/993891.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/993/993891.png',
      // Keep notification visible until user interacts (fixes "missing" notifications on some OS)
      requireInteraction: true,
      // Vibration pattern for mobile
      vibrate: [100, 50, 100],
      tag: 'fhb-notification', // Stacks notifications with same tag
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If app is open, focus it
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (event.notification.data.url) {
             client.navigate(event.notification.data.url);
          }
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
