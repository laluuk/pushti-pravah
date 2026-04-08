const CACHE_NAME = 'pushti-pravah-v6';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',

  // Icons
  '/images/icons/logo-192.png',
  '/images/icons/logo-512.png',

  // Samay icons (add any others you have)
  '/images/icons/samay/mangala.png',
  '/images/icons/samay/shringar.png',
  '/images/icons/samay/gval.png',
  '/images/icons/samay/rajbhog.png',
  '/images/icons/samay/uthapan.png',
  '/images/icons/samay/bhog.png',
  '/images/icons/samay/sandhya.png',
  '/images/icons/samay/shayan.png'
];

// Helper
async function safeFetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (e) {
    console.warn('Failed to fetch', url, e);
    return null;
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 1. Cache core assets
      await cache.addAll(CORE_ASSETS);

      // 2. Load index files
      const kirtanIndex = await safeFetchJSON('/data/kirtans.json');
      const leelaIndex = await safeFetchJSON('/data/leelas.json');

      // 3. Build dynamic lists
      const kirtanFiles = kirtanIndex
        ? kirtanIndex.kirtans.map(k => `/data/kirtans/${k.id}.json`)
        : [];

      const leelaFiles = leelaIndex
        ? leelaIndex.leelas.map(l => `/data/leelas/${l.id}.json`)
        : [];

      // 4. Cache all content JSON files
      const allContent = [...kirtanFiles, ...leelaFiles];

      await cache.addAll(allContent);
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys.map(key => key !== CACHE_NAME && caches.delete(key))
        )
      )
    ])
  );
});

// Cache-first strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
