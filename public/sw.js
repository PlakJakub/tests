const CACHE_NAME = "camera-pwa-v6";
const APP_BASE_PATH = new URL(self.registration.scope).pathname;
const APP_SHELL_PATHS = new Set(
  ["", "index.html", "manifest.webmanifest", "icons/icon.svg"].map(
    (path) => new URL(path, self.registration.scope).pathname,
  ),
);
const APP_SHELL = [...APP_SHELL_PATHS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const isAppShell = APP_SHELL_PATHS.has(url.pathname);
  const isBuiltCode =
    url.pathname.startsWith(`${APP_BASE_PATH}assets/`) &&
    (request.destination === "script" || request.destination === "style");

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith(`${APP_BASE_PATH}api/`) ||
    (!isAppShell && !isBuiltCode)
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const responseToCache = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return response;
      });
    }),
  );
});
