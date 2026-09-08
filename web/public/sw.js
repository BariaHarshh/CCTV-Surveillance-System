/* Offline shell — never pretends live camera/incident data is current. */
const CACHE = "acg-shell-v1";
const SHELL = ["/", "/offline", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return;
  event.respondWith(
    fetch(request)
      .then((res) => res)
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match("/offline");
      })
  );
});
