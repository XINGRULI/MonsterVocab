// 👇 关键修改：版本号变为 v3.0！只要这个名字变了，手机和电脑就会强制拉取最新代码
const CACHE_NAME = 'monster-vocab-v3.0'; 

// ⚠️ 这里的列表，绝不能出现不存在的文件，否则整个 PWA 会安装失败！
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './js/app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
];

// 安装阶段
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 激活阶段 (删除旧版本的幽灵缓存)
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

// 拦截请求（如果是向有道请求发音，直接跳过并联网）
self.addEventListener('fetch', (event) => {
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