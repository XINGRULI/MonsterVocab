const CACHE_NAME = 'monster-vocab-v1';
// 需要离线缓存的资源列表
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './icon.png',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js',
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&display=swap'
];

// 安装阶段：预缓存所有静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 激活阶段：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// 拦截网络请求：离线优先策略 (Cache First, fallback to Network)
self.addEventListener('fetch', (event) => {
  // 对于 TTS 语音等外部音频请求，直接放行不缓存
  if (event.request.url.includes('dictvoice') || event.request.url.includes('openspeech')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        console.log('完全断网且无缓存:', event.request.url);
      });
    })
  );
});