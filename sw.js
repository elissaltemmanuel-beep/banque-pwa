// build 2026-10-28-epargne-auto
// Cache d'abord (ouverture instantanée), puis mise à jour en arrière-plan pour le prochain lancement.
var CACHE = 'banque-shell';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'lib.js', 'google.js', 'lock.js', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'fonts/sora-latin.woff2'];
self.addEventListener('install', function (e) { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    var net = fetch(e.request, { cache: 'no-cache' }).then(function (r) {
      if (r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return r;
    });
    return hit || net.catch(function () { return hit; });
  }));
});
