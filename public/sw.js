/* PSYCH0 — service worker.
 * Network-first for pages (a den that lies about its content is worse than a
 * den that is briefly offline), cache-first for static chrome, and an offline
 * fallback shell so the OS still opens with no connection (PSYCH://OS local
 * mode keeps working from localStorage). Enables PWA install + share target. */
const CACHE = 'psych0-static-v2';
const SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => e.waitUntil(
  (async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })()
));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // static chrome: cache-first, refreshed in the background
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; });
      return hit || net;
    }).catch(() => fetch(e.request)));
    return;
  }

  // app APIs: never cached (freshness beats availability)
  if (url.pathname.startsWith('/api/')) return;

  // pages + assets: network first, cached shell when offline
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok && url.pathname === '/') {
      caches.open(CACHE).then(c => c.put('/', res.clone())).catch(() => {});
    }
    return res;
  }).catch(() => caches.match('/').then(hit => hit || caches.match('/index.html'))));
});
