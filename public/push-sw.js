/* Ride-mode Web Push, imported into the generated service worker (vite.config.ts `workbox.importScripts`). */
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        // A payload that isn't JSON still gets a notification.
    }
    // Safari revokes a subscription whose pushes show no notification.
    event.waitUntil(self.registration.showNotification(data.title || 'departs.app', { body: data.body, tag: data.tag, icon: '/icon.png' }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => (windows.length ? windows[0].focus() : self.clients.openWindow('/'))));
});
