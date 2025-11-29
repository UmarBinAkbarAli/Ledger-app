self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") return;

  event.respondWith(
    caches.open("ledger-cache-v1").then(async (cache) => {
      const cached = await cache.match(request);

      if (cached) return cached;

      try {
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      } catch {
        // offline fallback:
        return new Response("Offline", { status: 200 });
      }
    })
  );
});
