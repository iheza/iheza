// Service Worker for IHEZA School Management System
// Version-based cache to ensure updates are applied immediately
// Bump this version on EVERY deployment to force cache refresh
const CACHE_VERSION = 'v5-20260420a';
const CACHE_NAME = `iheza-cache-${CACHE_VERSION}`;

// Only cache truly static assets that rarely change
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico'
];

// Install event - cache only static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Force the waiting service worker to become active immediately
        console.log('[SW] Skip waiting - activating immediately');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete ALL old caches (any cache that doesn't match current version)
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      console.log('[SW] Claiming all clients');
      return self.clients.claim();
    }).then(() => {
      // Notify all clients to reload for the new version
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// Fetch event - Network-first strategy for all JS/CSS/HTML
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip API calls - never cache these
  if (url.pathname.startsWith('/api')) {
    return;
  }
  
  // For JS, CSS, and HTML files - ALWAYS fetch from network (no caching)
  // This ensures users always get the latest build
  if (url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') || 
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname.startsWith('/static/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Only use cache as fallback if network fails
          return caches.match(event.request).then((cachedResponse) => {
            // If not in cache, return a proper offline response
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response('Offline - Content not available', { 
              status: 503, 
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        })
    );
    return;
  }
  
  // For static assets (images, fonts, manifest) - cache-first strategy
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.replace('/', '')))) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).then((fetchResponse) => {
            // Cache the fetched response
            if (fetchResponse.ok) {
              const responseClone = fetchResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return fetchResponse;
          });
        })
    );
    return;
  }
  
  // For everything else - network only with error handling
  // This prevents 503 errors for dynamic content
  event.respondWith(
    fetch(event.request).catch((error) => {
      console.log('[SW] Fetch failed, returning empty response:', error);
      // Return a minimal response to avoid "Failed to fetch" error
      return new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    })
  );
});

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received skip waiting message');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Clearing all caches');
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    });
  }
});
