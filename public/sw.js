// Wisdom Dictionary Service Worker - Network First Cache Buster
const CACHE_NAME = 'wisdom-dict-v2.7.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch directly from network to ensure 100% fresh code
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
