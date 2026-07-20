// Bump this whenever the caching strategy changes; old caches are deleted on activate.
const CACHE = "ledger-cache-v2";

// Assets that are safe to serve cache-first (content-addressed or rarely changing).
const CACHE_FIRST = /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/i;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous versions so stale bundles can't survive a deploy.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only handle our own origin. Firebase/Firestore/Google Fonts must never be
  // served from cache — doing so returns stale ledger data and can break auth.
  if (url.origin !== self.location.origin) return;

  // Never cache API routes or Next.js dev/HMR traffic.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/webpack-hmr")) return;

  if (CACHE_FIRST.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else (HTML documents, JS, CSS) is network-first, so a deploy
  // reaches users immediately instead of being pinned to the old bundle.
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Offline fallback only makes sense for page navigations — returning a
    // placeholder body for a JS/CSS request would break the page outright.
    if (request.mode === "navigate") {
      return new Response(
        "<h1>Offline</h1><p>This page isn't available offline.</p>",
        { status: 503, headers: { "Content-Type": "text/html" } }
      );
    }
    return Response.error();
  }
}
