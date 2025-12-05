const CACHE_NAME = 'mcadence-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  // Add other static assets here
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only cache GET requests for our own domain
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return fetch(request);
  }

  // Try to serve from cache first
  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.match(request)
          .then((response) => {
            // Return cached version or fetch from network
            return response || fetch(request);
          });
      })
      .catch(() => {
        // If cache fails, try network
        return fetch(request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
