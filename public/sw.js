/*
 * Flow Day Planner service worker: app-shell caching + Web Push.
 *
 * Privacy invariant: only same-origin application assets/pages are cached.
 * Supabase and all cross-origin API responses always stay network-only.
 */
const VERSION = "v2";
const STATIC_CACHE = `flow-day-static-${VERSION}`;
const PAGE_CACHE = `flow-day-pages-${VERSION}`;
const OWN_CACHE_PREFIXES = ["flow-day-static-", "flow-day-pages-"];
const BOOTSTRAP_URLS = ["/", "/auth", "/manifest.webmanifest", "/icon-512.png"];

function isCacheableResponse(response) {
  return response && response.ok && (response.type === "basic" || response.type === "default");
}

function isStaticRequest(request, url) {
  if (["script", "style", "font", "image"].includes(request.destination)) return true;
  return /\.(?:js|mjs|css|woff2?|png|jpe?g|svg|webp|ico)$/.test(url.pathname);
}

async function putIfCacheable(cacheName, request, response) {
  if (!isCacheableResponse(response)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        BOOTSTRAP_URLS.map(async (url) => {
          const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
          if (isCacheableResponse(response)) await cache.put(url, response);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              OWN_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)) &&
              name !== STATIC_CACHE &&
              name !== PAGE_CACHE,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const origin = self.location.origin;
      const urls = [...new Set(event.data.urls)]
        .map((value) => {
          try {
            return new URL(value, origin);
          } catch {
            return null;
          }
        })
        .filter((url) => url && url.origin === origin)
        .filter((url) => !url.pathname.startsWith("/api/"))
        .filter((url) => !url.pathname.startsWith("/~oauth"))
        .filter((url) => url.pathname !== "/sw.js");

      await Promise.allSettled(
        urls.map(async (url) => {
          const request = new Request(url.href, { credentials: "same-origin" });
          const response = await fetch(request);
          if (isCacheableResponse(response)) await cache.put(request, response);
        }),
      );

      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) client.postMessage({ type: "FLOW_DAY_CACHE_READY" });
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache authenticated APIs, OAuth traffic, or third-party resources.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/~oauth")) return;
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          await putIfCacheable(PAGE_CACHE, request, response);
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return (
            (await caches.match("/")) ||
            (await caches.match("/auth")) ||
            new Response("Flow Day Planner est hors ligne.", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }

  if (isStaticRequest(request, url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        await putIfCacheable(STATIC_CACHE, request, response);
        return response;
      })(),
    );
  }
});

// Web Push is handled by the same root-scoped worker so push and offline mode
// cannot replace each other's service-worker registration.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Rappel", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Rappel";
  const tag = payload.tag || `flow-day-${payload.kind || "reminder"}-${payload.refId || "generic"}`;
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-512.png",
    badge: payload.badge || "/icon-512.png",
    tag,
    renotify: payload.renotify !== false,
    silent: payload.silent === true,
    timestamp: payload.timestamp || Date.now(),
    vibrate: payload.vibrate || [250, 100, 250],
    data: {
      url: payload.url || "/today",
      taskId: payload.taskId || null,
      kind: payload.kind || "reminder",
    },
    actions: Array.isArray(payload.actions)
      ? payload.actions
      : [{ action: "open", title: "Ouvrir Flow Day" }],
    requireInteraction: payload.requireInteraction !== false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});
