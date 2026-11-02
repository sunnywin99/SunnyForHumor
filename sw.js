// 離線快取：安裝到手機主畫面後，沒網路也能練習（語音辨識除外，它需要網路）
const CACHE = 'sfh-v3';
const FILES = ['./', 'index.html', 'css/style.css', 'js/speech.js', 'js/core.js', 'js/humor/data.js', 'js/humor/theory.js', 'js/humor/app.js', 'js/speak/data.js', 'js/speak/app.js', 'js/host/app.js', 'js/main.js', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('activate', (e) =>
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
);
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request))
  );
});
