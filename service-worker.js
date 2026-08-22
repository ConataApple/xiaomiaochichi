// 小喵吃吃 - Service Worker（network-first，离线 fallback）
// 改版本号会让旧 cache 自动失效
const CACHE = 'xiaomiao-v2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './config.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 只处理同源静态资源；Supabase API / CDN 直走网络
  if (url.origin !== location.origin) return;

  // 对 HTML：network-first（保证每次看到最新版）
  // 对其他静态资源：stale-while-revalidate（旧版先返回，后台拿新版替换）
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // 其它资源：stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkFetch = fetch(e.request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
