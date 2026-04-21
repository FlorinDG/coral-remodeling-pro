// Self-destruct: this SW is no longer needed.
// On activation it clears all caches and unregisters itself.
// Does NOT force a client.navigate() — that caused a 404 flash
// during the unregistration race. The browser handles the next
// request natively once the SW is gone.

self.addEventListener('install', () => {
    // Take control immediately — don't wait for existing SW to finish
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.map(name => caches.delete(name))))
            .then(() => self.registration.unregister())
        // Intentionally no c.navigate() — the browser will fetch
        // subsequent requests normally once the SW is unregistered.
    );
});

// Pass all fetch requests through to the network — no caching.
// This is the fail-safe: even if activate hasn't run yet, nothing
// is served from cache.
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
