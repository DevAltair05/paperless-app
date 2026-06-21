// ─────────────────────────────────────────────
// PAPERLESS — Service Worker
// Developer: Dev Nahin
// Caches the entire app so it works offline
// after the very first load with internet.
// ─────────────────────────────────────────────

const CACHE_NAME = 'paperless-v1';

// All files to cache on install
const FILES_TO_CACHE = [
  '/paperless-app/',
  '/paperless-app/index.html',
  '/paperless-app/sw.js',
  'https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.30.0/iconfont/tabler-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.30.0/iconfont/fonts/tabler-icons.woff2'
];

// ── INSTALL — cache all app files ────────────
self.addEventListener('install', function(event){
  console.log('[Paperless SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      console.log('[Paperless SW] Caching app shell');
      // addAll fails if any file fails — use individual adds for resilience
      return Promise.allSettled(
        FILES_TO_CACHE.map(url => cache.add(url).catch(e => {
          console.warn('[Paperless SW] Failed to cache:', url, e);
        }))
      );
    })
  );
  // Activate immediately without waiting
  self.skipWaiting();
});

// ── ACTIVATE — clean up old caches ───────────
self.addEventListener('activate', function(event){
  console.log('[Paperless SW] Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames){
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[Paperless SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ── FETCH — serve from cache, fallback to network ──
self.addEventListener('fetch', function(event){
  // Only handle GET requests
  if(event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cachedResponse){

      // Serve from cache if available
      if(cachedResponse){
        // Also fetch fresh version in background to update cache
        fetch(event.request).then(function(networkResponse){
          if(networkResponse && networkResponse.status === 200){
            caches.open(CACHE_NAME).then(function(cache){
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(function(){
          // No internet — that's fine, we served from cache
        });
        return cachedResponse;
      }

      // Not in cache — try network
      return fetch(event.request).then(function(networkResponse){
        // Cache the new response for next time
        if(networkResponse && networkResponse.status === 200){
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache){
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(function(){
        // Both cache and network failed — serve index.html as fallback
        console.log('[Paperless SW] Offline fallback for:', event.request.url);
        return caches.match('/paperless-app/index.html');
      });
    })
  );
});

// ── MESSAGE — force update from app ──────────
self.addEventListener('message', function(event){
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
