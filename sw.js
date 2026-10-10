'use strict';
const ROOT = new URL('./', self.location.href);
const APP = new URL('index.html', ROOT).href;
const PREFIX = 'smartscan-offline-' + encodeURIComponent(ROOT.pathname) + '-';
const VERSION = '1.4.10';
const CACHE = PREFIX + VERSION;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(APP, {cache: 'reload'});
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('Could not load the app');
    }
    const html = await response.clone().text();
    if (!html.includes('data-app-version="'+VERSION+'"')) throw new Error('Release not ready');
    const cache = await caches.open(CACHE);
    await cache.put(APP, response);
    await self.skipWaiting();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='GET_APP_VERSION')event.source?.postMessage({type:'APP_VERSION',version:VERSION});
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
    // Installed launches use the saved release. reg.update checks the small worker file.
    if(url.searchParams.get('launch')==='app') {
      const saved=await cache.match(APP);if(saved)return saved;
    }
    // Prefer the current release online; use the saved copy on failure or timeout.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(APP, {cache:'no-cache', signal:controller.signal});
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('App unavailable');
      await cache.put(APP, response.clone());
      return response;
    } catch {
      const cached = await cache.match(APP);
      if (cached) {
        const html = (await cached.text()).replace(/<head(\s[^>]*)?>/i, match => match +
          '<script>window.__SMARTSCAN_OFFLINE__=true;document.documentElement.classList.add("offline-app-mode","skip-welcome");</script>');
        return new Response(html, {headers:{'Content-Type':'text/html; charset=utf-8'}});
      }
      return new Response('Offline copy missing. Open this page online once.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    } finally { clearTimeout(timeout); }
  })());
});

const MANIFEST = {
  id: ROOT.pathname, name: '2simple2scan', short_name: '2simple2scan',
  start_url: ROOT.pathname + '?launch=app', scope: ROOT.pathname, display: 'standalone',
  background_color: '#090d16', theme_color: '#121826',
  icons: [192,512].map(size => ({src: new URL('smartscan-icon-' + size + '.png', ROOT).href, sizes: size + 'x' + size, type: 'image/png', purpose: 'any'}))
};
const ICONS = {"192":"iVBORw0KGgoAAAANSUhEUgAAAMAAAADABAMAAACg8nE0AAAAMFBMVEUHe/8He/8He/8HfP8He/8IfP////+52v9Kn/+IwP/D3/+93P+fzP8xkv/g7/9ztf9wzciDAAAABXRSTlMB5sKRUJ0FmWQAAAAJcEhZcwAACxMAAAsTAQCanBgAAAOvSURBVHja7Zw9aFNRFMdjjLtFs4dqdxW7V4p7o17N0CTbjaZNupnBt7Y4CN0KguBUC7or6NyAgzglIIibWZ2SycEWtXnnvvt97x+i3LOF9975cc65H+/lnnNKJVEq68tLVeYh9aXlm2slk1RusCC5YkCss2C5qtN/nUWQS2r9qyyK3AXrVxJusWhyWaa/zCJKTTI+qzEB9TVcABRhKLPIIjppJTbgDtV/jkWXiwRQjQ+oQyMgRmEFAchF4TyDyLUzwG0M4B4yxCTMZQaSGtZDcx9VUYA6dAzNx9EFHGADsVAXF20GFFkImi+efPgjn+y0fP17/7uPI0kQhJW6PeFz2bXR38g90J8W12w6Cxp5/fy7DaCVf6K/W5gJdCWd5e/mPRvAmDyyU4gydRAPBfCpEOUK+b1Hb3Z3EecPycU1YRBN6M3OQT6NgjCMykUPvfEdpu+LPqrRhaJVdKKTtAt+3aCjdGwbWF3Ae3ScEsBBmAG/TdihALLUDU+uhy0+Jwq26UQg8+wx590wwCvOO/TdZUW4HA7oUkAVC6jjAewfB7AEWHDAF2F7yMl2DECbq6VzHAFwoANk4YAG1wEGx8GAlh6QBQPGeoDcBBfAzADIPABvOd+yivEpQGoC0VAEDPMD3AiQmTAUp0hJfCno2QNkJozF15KS8G6dezs2AyQmEA1FAGuOmANAZkJT+AbRfEBZADKLj6gggGI6RwRkaIDZhFBAhgYYTQgGZGiAyYRwQIYGGEyIAMjQAL0JMQAZGqA1wRfQHViaEAWgM8EX0B9YmuAL4EeWJngDtixN8AbYmuAP6L+2MsEfIEgCJEACJEAC6AE/nqplfxIO6Ghf3B6EA/T/xjfDAYfG/9AWHQB3ETzI8GGalooESIC0o6UdLe1oaUdLgARIgIXe0Z75AiQHdfLFbk8F0B/UyY4a5cv1pgJgOGqUHZYe2qSmnQEMh6Wy4143gOG4V3Zg7eYiw4E1OTD3CrLLmb7XMPUBOE20BEiABPgfAbpkyhkasOeiv68EqBNa77sAHikTWtUpuZsugJ4yJXdVnVQ8cQBMmSqpWJMW/c3dQ5K0aF1i99A6xLvqxG5tavr+cyt5OdKkpsOT6+HlAfACB3iJhlBIBCgygZfJwAt9CqVKP/1LlT6PZPVijGGLrfDlYvCCN3jJHrzoEF82CS/8hJeu4otv4eXD8AJofAk3vAgdX0YPbwSAb2UAb8aAbycBb4iBb+mBb0qCb6uCbwyDb22Db84Tv73QL9eEyxshdufCAAAAAElFTkSuQmCC","512":"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"};
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin) return;
  if (url.pathname === new URL('smartscan.webmanifest', ROOT).pathname) {
    event.respondWith(new Response(JSON.stringify(MANIFEST), {headers:{'Content-Type':'application/manifest+json'}}));
  }
  for (const size of [192,512]) {
    if (url.pathname === new URL('smartscan-icon-' + size + '.png', ROOT).pathname) {
      const bytes = Uint8Array.from(atob(ICONS[size]), ch => ch.charCodeAt(0));
      event.respondWith(new Response(bytes, {headers:{'Content-Type':'image/png'}}));
    }
  }
});
