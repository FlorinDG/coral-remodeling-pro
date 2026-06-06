/**
 * WorkHub Service Worker — Versioned App Shell + Network First strategy
 *
 * CROSS-7c: The cache name includes a version param from the registration URL.
 * When a new deployment registers the SW with a new ?v=SHA, the old caches are
 * purged on activate and the new app shell is cached.
 *
 * Caches the app shell (HTML, JS, CSS) for offline-capable launch.
 * API calls and dynamic content always go network-first.
 * Falls back to cached app shell when offline.
 */

// Derive cache version from the SW URL's ?v= param (set by the registering page)
const swUrl = new URL(self.location.href);
const BUILD_VERSION = swUrl.searchParams.get('v') || 'v1';
const CACHE_NAME = `workhub-${BUILD_VERSION}`;

// App shell assets to pre-cache on install
const APP_SHELL = [
  '/',
  '/offline',
];

// ── Install ────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()) // Take control immediately
  );
});

// ── Activate ───────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => {
        // Purge ALL caches that aren't the current version
        return Promise.all(
          names
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log(`[SW] Purging old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim()) // Claim all open tabs
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API calls, auth routes, and version endpoint — always network
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/login')) {
    return;
  }

  // Skip chrome-extension and browser-internal URLs
  if (!url.protocol.startsWith('http')) return;

  // Static assets (JS, CSS, images, fonts): Cache First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/branding/') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages: Network First, fallback to cache, then offline page
  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful HTML responses
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/offline');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

// ── Push Notifications (stub) ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'WorkHub';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'workhub-notification',
    data: data.url || '/',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
