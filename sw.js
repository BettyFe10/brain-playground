// Service worker di Brain Playground.
// Alla prima apertura scarica TUTTI i giochi, così funzionano offline anche se non li hai mai aperti.
// Dopo ogni modifica ai file aumenta VERSION, così i telefoni scaricano la nuova versione.
const VERSION = 'brain-playground-v5';
const ASSETS = [
  "./",
  "./2048/",
  "./calcudoku/",
  "./campominato/",
  "./flow/",
  "./hanoi/",
  "./labirinto/",
  "./luci/",
  "./memory/",
  "./nonogram/",
  "./parole/",
  "./snake/",
  "./solitario/",
  "./stelle/",
  "./sudoku/",
  "./takuzu/",
  "./2048/app.js",
  "./2048/index.html",
  "./calcudoku/app.js",
  "./calcudoku/index.html",
  "./campominato/app.js",
  "./campominato/index.html",
  "./flow/app.js",
  "./flow/index.html",
  "./hanoi/app.js",
  "./hanoi/index.html",
  "./home.js",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./labirinto/app.js",
  "./labirinto/index.html",
  "./luci/app.js",
  "./luci/index.html",
  "./manifest.webmanifest",
  "./memory/app.js",
  "./memory/index.html",
  "./nonogram/app.js",
  "./nonogram/index.html",
  "./parole/app.js",
  "./parole/index.html",
  "./parole/words.js",
  "./shared/arcade.css",
  "./shared/base.css",
  "./shared/fonts/nunito.woff2",
  "./shared/mascot.svg",
  "./shared/ui.js",
  "./snake/app.js",
  "./snake/index.html",
  "./solitario/app.js",
  "./solitario/index.html",
  "./stelle/app.js",
  "./stelle/index.html",
  "./sudoku/app.js",
  "./sudoku/index.html",
  "./takuzu/app.js",
  "./takuzu/index.html"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Prima la copia salvata (istantanea e offline), poi aggiorna in background se c'è rete.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('./')) || Response.error();
    return Response.error();
  })());
});
