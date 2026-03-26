const CACHE_NAME = "financeiro-voice-v3";
const APP_SHELL = ["/", "/manifest.json", "/icons/icon-192.svg", "/icons/icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isApiRequest = requestUrl.pathname.startsWith("/api/");
  const isDocumentRequest = event.request.mode === "navigate";
  const isStaticAsset =
    requestUrl.pathname.startsWith("/icons/") ||
    requestUrl.pathname === "/manifest.json" ||
    requestUrl.pathname.startsWith("/_next/static/");

  if (!isSameOrigin || isApiRequest) {
    return;
  }

  if (isDocumentRequest) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => networkResponse)
        .catch(() => caches.match("/")),
    );
    return;
  }

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          void caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });

          return networkResponse;
        })
        .catch(() => caches.match("/"));
    }),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload = {
    title: "Lembrete financeiro",
    body: "Você tem um vencimento para acompanhar.",
    tag: "financeiro-reminder",
    data: {
      url: "/summary",
    },
  };

  try {
    payload = { ...payload, ...event.data.json() };
  } catch (_error) {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: payload.data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/summary";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate?.(targetUrl);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
