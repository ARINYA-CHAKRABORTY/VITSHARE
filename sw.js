const CACHE_NAME = 'vitshare-cache-v162';
const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './campus-banner.jpg',
  './jszip.min.js',
  './qrcode.min.js'
];
// NOTE: index.html and env.js are intentionally NOT cached.
// They must always be fetched fresh from the network.

// Install: cache only truly static assets, NOT index.html
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: delete ALL old caches and immediately take control
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('VitShare SW: Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: NEVER serve index.html or env.js from cache — always go to network
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Always fetch fresh from network for HTML pages and env.js (never cache them)
  const isHTMLOrConfig =
    e.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('env.js') ||
    url.pathname.endsWith('sw.js');

  if (isHTMLOrConfig) {
    // Network-only for HTML + config — fallback to cache only when fully offline
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for static assets (images, manifest, icons)
  const isStaticAsset = STATIC_ASSETS.some((asset) => {
    const cleanAsset = asset.replace(/^\.\//, '');
    return url.pathname.endsWith(cleanAsset);
  });

  if (isStaticAsset) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then((cached) => {
        return cached || fetch(e.request).then((netResp) => {
          if (netResp && netResp.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, netResp.clone()));
          }
          return netResp;
        });
      })
    );
    return;
  }

  // Everything else (Supabase API, CDN scripts): pass straight through to network
});
