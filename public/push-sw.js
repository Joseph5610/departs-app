/* Ride-mode Web Push, imported into the generated service worker (vite.config.ts `workbox.importScripts`). */
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        // A payload that isn't JSON still gets a notification.
    }
    // Declarative Web Push (`web_push: 8030`) nests the notification; Safari 18.4+ shows it without this handler.
    const notification = data.notification || data;
    // Safari revokes a subscription whose pushes show no notification.
    event.waitUntil(self.registration.showNotification(notification.title || 'departs.app', {
        body: notification.body,
        tag: notification.tag,
        renotify: Boolean(notification.tag && notification.renotify),
        requireInteraction: Boolean(notification.requireInteraction),
        vibrate: notification.vibrate,
        icon: '/icon.png',
        // Android's status bar shows only this image's alpha.
        badge: '/notification-badge.png',
        timestamp: Date.now(),
        data: { navigate: notification.navigate },
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.navigate) || '/';
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
        const open = windows[0];
        if (!open) return self.clients.openWindow(url);
        // `navigate` fails on a window this worker doesn't control; a new window still opens the ride.
        return open.focus().then((client) => client.navigate(url)).catch(() => self.clients.openWindow(url));
    }));
});
