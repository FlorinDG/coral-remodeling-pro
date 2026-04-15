// Self-destruct: this SW is no longer needed.
// On activation it clears all caches and unregisters itself.
// Browsers auto-fetch sw.js every 24h, so any user with the old
// SW will get this version and it will clean itself up.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.map(name => caches.delete(name))))
            .then(() => self.registration.unregister())
            .then(() => self.clients.matchAll())
            .then(clients => clients.forEach(c => c.navigate(c.url)))
    );
});
