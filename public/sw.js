/* Tropicash minimal service worker — static shell only; no wallet/payment/auth caching. */
const VERSION = "tropicash-sw-1";
const STATIC_CACHE = `${VERSION}-static`;

const PRECACHE_URLS = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

/**
 * Requests we must not store or intercept beyond a plain network fetch.
 */
function isSensitiveRequest(url) {
  const h = url.hostname.toLowerCase();
  const p = url.pathname;
  if (h.includes("supabase.co")) return true;
  if (h.includes("paypal.com") || h.includes("paypalobjects.com")) return true;
  if (p.startsWith("/api/")) return true;
  if (p.startsWith("/_next/data/")) return true;
  return false;
}

function isNavigationRequest(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

function isNextStaticAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

function offlineHtmlResponse() {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#003B73" />
  <title>Tropicash — Offline</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a; padding: 1.5rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 0.75rem; }
    p { margin: 0 0 1rem; color: #475569; line-height: 1.5; max-width: 22rem; }
    a { color: #003B73; font-weight: 600; }
  </style>
</head>
<body>
  <div>
    <h1>You are offline</h1>
    <p>Tropicash needs a connection to load your wallet. Reconnect and try again. Balances and payments are not available offline.</p>
    <p><a href="/">Go home</a></p>
  </div>
</body>
</html>`;
  return new Response(body, {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== STATIC_CACHE) return caches.delete(key);
            return undefined;
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (isSensitiveRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(fetch(request).catch(() => offlineHtmlResponse()));
    return;
  }

  if (isNextStaticAsset(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response("", { status: 504, statusText: "Gateway Timeout" });
          }),
        ),
    );
    return;
  }

  // Default: network-only (no caching of arbitrary same-origin responses).
  event.respondWith(fetch(request));
});
