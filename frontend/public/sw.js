const CACHE_NAME = 'expense-tracker-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

const API_CACHE_NAME = 'expense-tracker-api-v1';
const API_ROUTES = ['/categories', '/transactions', '/reports'];

const IMAGE_CACHE_NAME = 'expense-tracker-images-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('expense-tracker-') && 
                   name !== CACHE_NAME && 
                   name !== API_CACHE_NAME &&
                   name !== IMAGE_CACHE_NAME;
          })
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and websocket connections
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests - network first, cache fallback
  if (API_ROUTES.some(route => url.pathname.includes(route))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(API_CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            // Return offline JSON response
            return new Response(
              JSON.stringify({ error: 'Offline mode - data may be stale' }),
              { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Handle image requests - cache first, network fallback
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) {
            // Refresh cache in background
            fetch(request).then((response) => {
              cache.put(request, response.clone());
            });
            return cached;
          }
          return fetch(request).then((response) => {
            cache.put(request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // Static assets - stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cached);

        return cached || fetchPromise;
      });
    })
  );
});

// Background sync for offline transactions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'New notification from Expense Tracker',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: 'expense-tracker-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Expense Tracker', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || event.action === '') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

async function syncPendingTransactions() {
  // Placeholder for sync logic
  // Would sync IndexedDB pending transactions with server
  console.log('Syncing pending transactions...');
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-sync') {
    event.waitUntil(syncPendingTransactions());
  }
});
