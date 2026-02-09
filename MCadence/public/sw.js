const CACHE_NAME = 'mcadence-v3';
const urlsToCache = [
  '/',
  '/manifest.json',
  // Add other static assets here
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests for our own origin
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // Bypass caching for Next.js assets and API routes to avoid stale/hanging refresh
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  // Network-first for navigations to prevent serving stale HTML
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Cache-first for other static assets
  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(request))
      .then((response) => response || fetch(request))
      .catch(() => fetch(request))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim(),
    ])
  );
});
