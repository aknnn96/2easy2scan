'use strict';
const ROOT = new URL('./', self.location.href);
const APP = new URL('index.html', ROOT).href;
const PREFIX = 'smartscan-offline-' + encodeURIComponent(ROOT.pathname) + '-';
const CACHE = PREFIX + 'v1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(APP, {cache: 'reload'});
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('App konnte nicht geladen werden');
    }
    const cache = await caches.open(CACHE);
    await cache.put(APP, response);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin ||
      ![ROOT.pathname, new URL(APP).pathname].includes(url.pathname) ||
      event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Return the saved app immediately, including when connectivity hangs.
    const cached = await cache.match(APP);
    const refresh = fetch(APP, {cache: 'no-cache'}).then(async response => {
      if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
        await cache.put(APP, response.clone());
      }
      return response;
    });
    event.waitUntil(refresh.then(() => {}, () => {}));
    if (cached) return cached;
    try { return await refresh; }
    catch { return new Response('Offline-Kopie fehlt. Bitte einmal online öffnen.', {status: 503, headers: {'Content-Type':'text/plain; charset=utf-8'}}); }
  })());
});
