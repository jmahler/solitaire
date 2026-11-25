const CACHE_NAME = 'solitaire-v6';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './js/app.js',
  './js/engine.js',
  './js/renderer.js',
  './js/games/klondike.js',
  './js/games/freecell.js',
  './js/games/spider.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
