// build 2026-10-25-verre
// Réseau d'abord (mises à jour immédiates), cache en secours pour l'ouverture hors ligne.
var CACHE = 'banque-shell';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'lib.js', 'google.js', 'lock.js', 'config.js', 'manifest.webmanifest', 'icon-192.png'];
self.addEventListener('install', function (e) { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(function (r) {
    var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r;
  }).catch(function () { return caches.match(e.request); }));
});
