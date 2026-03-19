const CACHE = 'uak-v2';

const LOCAL_ASSETS = [
  '/uak.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Lokálne assety musia byť v cache — ak zlyhajú, inštalácia zlyhá
      await cache.addAll(LOCAL_ASSETS);
      // Externé assety cachujeme best-effort
      await Promise.allSettled(EXTERNAL_ASSETS.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // UAK API requesty — nikdy necachuj, vždy živé (alebo timeout)
  if (url.hostname === '4.3.2.1' && url.port === '8080') return;

  // Navigačné requesty — vždy vráť uak.html z cache (offline SPA)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then(cache => cache.match('/uak.html'))
    );
    return;
  }

  // Cache-first pre všetko ostatné
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp && resp.status === 200) {
            cache.put(e.request, resp.clone());
          }
          return resp;
        }).catch(() => cached || new Response('Offline', { status: 503 }));
      })
    )
  );
});
