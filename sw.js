'use strict';
const ROOT = new URL('./', self.location.href);
const APP = new URL('index.html', ROOT).href;
const PREFIX = 'smartscan-offline-' + encodeURIComponent(ROOT.pathname) + '-';
const CACHE = PREFIX + 'v3';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(APP, {cache: 'reload'});
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('Could not load the app');
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
  id: ROOT.pathname, name: 'SmartScan Pro', short_name: 'SmartScan',
  start_url: ROOT.pathname + '?launch=app', scope: ROOT.pathname, display: 'standalone',
  background_color: '#090d16', theme_color: '#121826',
  icons: [192,512].map(size => ({src: new URL('smartscan-icon-' + size + '.png', ROOT).href, sizes: size + 'x' + size, type: 'image/png', purpose: 'any'}))
};
const ICONS = {192: 'iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAIAAADdvvtQAAADKUlEQVR4nO3dQW4bNxiA0XGRE3iVEwToLufKgXqu7nqdLgzICZLArj+NyOn/3lowRuRncqwh5Kfnz18O+Kg/Vl8A1yYgEgGRCIhEQCQCIhEQiYBIBEQiIBIBkQiIREAkAiIREImASAREIiASAZEIiERAJAIiERCJgEgERCIgEgGRCIhEQCQCIhEQiYBIBEQiIBIBkQiIREAkAiIREImASAREIiASAZEIiERAJAIiERCJgEgERCIgEgGRCIhEQCSfVl/AD/789vfqS7iAf/76uvoSXj3t82+/1fOfbJLRFgFJ52N2aMg90IXt8Iu3PqAdRuG6lo/e4oCWv///gbVjuH4F4tIERCIgkr0+SPzeDn+jbmXP+0UrEImASAREIiASAZEIiERAJAIiERCJgEgERCIgkn0fpi70u8eWnu/+TECv3nzcfXuBkm4E9JFjEkq6mX4PFA/Z7HlG55FGB3SX6R/e0NAt7L6z/vLTZm5nE1egk9aMmUvRxIC4o3EBnbpODFyEZgX0gAme1tCggB42taMaGhQQZxAQyZSAHrytzNnFpgTESQREMiKgJRvKkF1sRECcR0AkAiIREImASAREIiCSEQEtOWw65ITriIA4j4BIpgT04A1lyP51zAmIkwiIZFBAD9tW5uxfx6iAjodM7ah6jmkBHSdP8LR6joEBcV8TAzppnRi4/Bxjv53jZbLvdep0ZjovJq5AN3eZ+Mn1HMMDOvL0D6/nGLuFfe8Wwft3NN3cCOjVmyXp5mcC+gWhvN/0eyAiAZEIiERAJAIiERCJgEgERCIgEgGRCIhEQCQCItn3afyQbzm9OisQiYBIFgfk6Fa3dgytQCTrA7IIFctHb31AxwajcFE7jNsWAR17jMW1bDJiT8+fv6y+hlc++3mPTdJ5sVdAXM4uWxgXJSASAZEIiERAJAIiERCJgEgERCIgEgGRCIhEQCQCIhEQiYBIBEQiIBIBkQiIREAkAiIREImASAREIiASAZEIiERAJAIiERCJgEgERCIgEgGRCIhEQCQCIhEQiYBIBEQiIBIBkQiIREAkAiIREImASAREIiASAZEIiORfBYR2+Z/eMxsAAAAASUVORK5CYII=', 512: 'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAAJwUlEQVR4nO3dS24VyRZAUXjyCGgxAiT3PC4G5HHR83ReA8lClGWuPxm/vVa7qogIZZ6dmcaqr9++//gCQM//Zi8AgDkEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAgSgAAogQAIEoAAKIEACBKAACiBAAg6m72Avhy//PX7CXAHE+PD7OXkPb12/cfs9cQZe7DMyWYQgAmMPrhRTIwmAAMZfTDP8nAMH4IPI7pD7dwpwwjAIO4puF27pcxBGAEVzO8lbtmAAG4nOsY3se9czUBuJYrGD7CHXQpAbiQaxc+zn10HQEAiBKAq3hsgc/ibrqIAABECcAlPLDA53JPXUEAAKIEACBKAD6fd1W4gjvr0wkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAETdzV4Ar3l6fJi9BPgov8C1LG8AAFECABAlAABRAgAQJQAAUQIAECUAAFECABAlAABRAgAQJQAAUQIAECUAAFECABAlAABRAgAQJQAAUQIAECUAAFECABAlAABRAgAQJQAAUQIAECUAAFECABAlAABRAgAQJQAAUQIAECUAAFECABAlAABRAgAQJQAAUXezFwCD3P/8deM/+fT4cOE6YBkCwLFun/iv/4t6wKkEgKO8e+jf+N8UA04iAJzgirn/+h+kBBxAANjbsNH/4p8rA2xNANjVrNH/3zXIAJsSAPazwuj/kwywKQFgJ6uN/j/JANvxi2BsY+Xp/2yLRcJv3gDYwF5T1asAu/AGwOr2mv7PNl02KQLA0rYeo1svngKfgFjUGdPT5yBW5g2AFZ0x/Z8dth2OIQAs58hxeeSm2J0AsJaDB+XBW2NTAsBCjh+Rx2+QvQgAq4gMx8g22YIAsITUWExtlpUJAECUADBf8Ik4uGUWJABMlh2F2Y2zDgFgpvgQjG+f6QQAIEoAmMbz7xeHwFQCwBwG3zNHwSwCABAlAEzgmfcvDoQpBAAgSgAYzdPuixwL4wkAQJQAMJTn3Fc4HAYTAIAoAWAcT7j/5IgYSQAAogQAIEoAGMTHjRs5KIYRAIAoAQCIEgCAKAFgBN+138RxMYYAAEQJAECUAABECQBAlABwOT/SfAeHxgACABAlAABRAgAQJQAAUQIAECUAAFECABAlAABRAgAQJQAAUQIAECUAAFECABAlAFzu6fFh9hL249AYQAAAogQAIEoAAKIEACBKABjBjzTfxHExhgAARAkAQJQAAEQJAIP4rn0jB8UwAgAQJQAAUQLAOD5u/JMjYiQBAIgSAIbyhPsKh8NgAgAQJQCM5jn3RY6F8QQAIEoAmMDT7l8cCFMIAECUADCHZ95njoJZBIBpDL4vDoGpBAAgSgCYKf78G98+0wkAk2WHYHbjrEMAmC84CoNbZkECABAlACwh9USc2iwrEwBWERmLkW2yBQFgIccPx+M3yF4EgLUcPCIP3hqbEgCWc+SgPHJT7E4AWNFh4/Kw7XCMu9kLgJf9Hpr3P39NXsfHGP2szBsAS9t6gG69eAoEgNVtOkY3XTYpPgGxgb0+Bxn97MIbANvYYrBusUj4zRsAO1n5VcDoZzsCwH5Wy4DRz6YEgF2tkAGjn60JAHublQGjnwMIACd4HsdXl8Dc5yQCwFH+HNCfFQNDn1MJAMf6a3Df3gMTnwgBoMJYh7/4RTCAKAEAiBIAgCgBAIgSAIAoAQCIEgCAKAEAiBIAgCgBAIgSAIAoAQCIEgCAKAEAiBIAgCgBAIgSAIAoAQCIEgCAKAEAiBIAgCgBAIgSAIAoAQCIEgCAKAEAiBIAgCgBAIgSAIAoAQCIEgCAKAEAiBIAgCgBAIgSAIAoAQCIupu9AF5z//PX7CUAx/IGABAlAABRAgAQJQAAUQIAECUAAFECABAlAMAenh4fZi/hNALw+VymwBYEACBKAACiBOASvgLB53JPXUEAAKIE4CoeWOCzuJsuIgDA0kz/6wjAhVy4wMoE4FoaAB/hDrqUAFzOFQzv4965mgCM4DqGt3LXDCAAg7ia4XbulzG+fvv+Y/YaQvxP3uF1Rv9IAjCBDMCLTP/BBGAaGYBnRv8UAjCfEtBk6E8nAABR/hYQQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAEDU/wH6oCnLipmnugAAAABJRU5ErkJggg=='};
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
