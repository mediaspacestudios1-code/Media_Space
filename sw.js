const CACHE_NAME = 'media-space-v1';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/styles.css',
  '/app.js',
  '/image/Final%20Logo.jpeg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip API calls from offline cache fallback
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 404 && event.request.mode === 'navigate') {
          return caches.match('/404.html') || response;
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return (await caches.match('/404.html')) || (await caches.match('/index.html'));
        }
      })
  );
});
