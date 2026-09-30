// Service Worker for IHEZA School Management System
// Version-based cache to ensure updates are applied immediately
// Bump this version on EVERY deployment to force cache refresh
const CACHE_VERSION = 'v12-20260915';  // BUMPED: resilient precache (allSettled, drop favicon) so a CDN 520 can't break SW install

const CACHE_NAME = `iheza-cache-${CACHE_VERSION}`;

// Only cache truly static assets that rarely change.
// NOTE: /favicon.ico is intentionally NOT precached here. It is served by the
// edge/CDN and can transiently fail (e.g. Cloudflare 520). Because cache.addAll()
// is atomic, a single failing URL aborts the whole install and breaks the SW.
// We precache only assets that reliably exist, and use Promise.allSettled so a
// single failure can never block activation.
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// Install event - cache only static assets (resilient to individual failures)
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // allSettled: one failed asset must not abort the install
        return Promise.allSettled(
          STATIC_ASSETS.map((url) => cache.add(url))
        );
      })
      .then(() => {
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
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming all clients');
      return self.clients.claim();
    }).then(() => {
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

  // 🔴 CRITICAL FIX: Bypass uploads FIRST — before any extension checks
  // This prevents /uploads/ebooks/book.html from being caught by the .html check below
  if (url.pathname.startsWith('/uploads/')) {
    console.log('[SW] Bypassing upload:', url.pathname);
    return; // Let browser handle it normally, no SW interception
  }

  // Skip API calls - never cache these
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // For JS, CSS, and HTML files - ALWAYS fetch from network (no caching)
  // Safe now because /uploads/ paths are already excluded above
  if (url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') || 
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname.startsWith('/static/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
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
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).then((fetchResponse) => {
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

  // For everything else - don't intercept, let browser handle normally
  return;
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

// ============ PUSH NOTIFICATIONS ============

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.warn('[SW] Could not parse push data:', e);
    data = { title: 'IHEZA Notification', body: 'You have a new notification' };
  }

  const title = data.title || 'IHEZA Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/logo192.png',
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    vibrate: [100, 50, 100],
    tag: data.tag || 'iheza-notification'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click - open the app at the notification's URL
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');

  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it and navigate to the URL
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

