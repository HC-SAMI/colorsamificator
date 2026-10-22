// ColorSAMificator offline support.
// Everything the app loads is kept in a cache as it's fetched, so the app
// opens and works with no connection (in the Android app too). Online, the
// site's own files and the colour data always come fresh from the network
// (the cache is only the fallback), so updates show up as before; the
// libraries from CDNs are served from the cache and refreshed behind the scenes.
// GitHub API calls that carry a token (sync, live link) are never cached.
const CACHE = "csam-offline-v1";
const SHELL = ["./", "./index.html", "./App.jsx", "./styles.css"];
const NET_TIMEOUT = 8000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("csam-offline-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The data loader adds ?t=<time> to raw GitHub URLs to dodge HTTP caches;
// the offline copy is kept under the address without it.
const keyOf = (req) => {
  const u = new URL(req.url);
  if (u.hostname === "raw.githubusercontent.com") { u.searchParams.delete("t"); return u.href; }
  return req.url;
};
const keep = async (key, res) => {
  if (!res || !(res.ok || res.type === "opaque")) return;
  try { const c = await caches.open(CACHE); await c.put(key, res); } catch (e) {}
};
const fromCache = async (key, req) => {
  const c = await caches.open(CACHE);
  return (await c.match(key)) || (await c.match(key, { ignoreSearch: true })) || (req.mode === "navigate" ? (await c.match("./index.html")) || (await c.match("./")) : undefined);
};
// network first; the cached copy when there's no connection, or when the
// network is slow and there is a copy (it's refreshed in the background)
const networkFirst = async (req) => {
  const key = keyOf(req);
  const net = fetch(req).then((res) => { keep(key, res.clone()); return res; });
  net.catch(() => {});
  try {
    return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), NET_TIMEOUT))]);
  } catch (e) {
    const hit = await fromCache(key, req);
    if (hit) return hit;
    return net; // nothing kept yet: wait for the network (or fail)
  }
};
// cached copy straight away, refreshed in the background
const cacheFirst = async (req) => {
  const key = keyOf(req);
  const hit = await fromCache(key, req);
  const net = fetch(req).then((res) => { keep(key, res.clone()); return res; }).catch(() => null);
  if (hit) return hit;
  const res = await net;
  return res || Response.error();
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.protocol !== "https:" && u.protocol !== "http:") return;
  if (u.hostname === "api.github.com") {
    // the data folder listing (no token) is kept so the app knows its files offline
    if (!req.headers.get("Authorization")) e.respondWith(networkFirst(req));
    return;
  }
  if (u.origin === self.location.origin || u.hostname === "raw.githubusercontent.com") { e.respondWith(networkFirst(req)); return; }
  e.respondWith(cacheFirst(req));
});
