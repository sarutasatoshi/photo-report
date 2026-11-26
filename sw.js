/* 写真報告書：電波がない所でもアプリを開けるようにするための仕組み（サービスワーカー）
   ・ネットにつながっているときは、いつも最新の画面を取りに行き、控えを端末に残す
   ・つながっていないときは、端末に残した控えで開く
   ※報告書や写真のデータはここでは扱わない（端末の中の別の場所に保存されている） */
const CACHE = 'photo-report-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 最新を取りに行く（4秒で返事がなければ控えを使う）
function fromNetwork(req) {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('timeout')), 4000);
    fetch(req, { cache: 'no-cache' }).then(r => { clearTimeout(timer); res(r); }, err => { clearTimeout(timer); rej(err); });
  });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const r = await fromNetwork(req);
      if (r && r.ok) cache.put(isPage ? './' : req, r.clone());
      return r;
    } catch (err) {
      const hit = isPage ? (await cache.match('./')) || (await cache.match('./index.html'))
                         : await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
