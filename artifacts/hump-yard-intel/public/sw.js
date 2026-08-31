// =============================================================================
// DECEL Intelligence Platform — service worker
//
// Strategy:
//   - /api/* requests: network-first. If network is down, fail with 503 so
//     the UI shows the "offline" badge. (We do NOT cache API responses —
//     data freshness is sacred for sales intelligence.)
//   - All other GET requests: stale-while-revalidate. Serve from cache if
//     available, then refresh from network in the background. This is what
//     makes the UI shell work offline at InnoTrans when Cassin's phone loses
//     Wi-Fi mid-meeting.
//
// Caching scope:
//   - HTML, CSS, JS, fonts, icons, manifest → cached on first install
//   - Auth tokens never touch the SW (no cache for /api/v1/auth/*)
//   - Source URLs (Exa, etc.) are external; SW doesn't intercept them
//
// Bump CACHE_VERSION on any frontend build that changes the bundle hash.
// The old cache is purged on activate.
// =============================================================================

const CACHE_VERSION = "v1";
const CACHE_NAME = `decel-shell-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/login",
  "/dossiers",
  "/review-queue",
  "/battle-cards",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        // Pre-cache failures are non-fatal — the SW still installs.
        console.warn("[sw] precache failed:", err);
      }),
    ),
  );
  // Take over immediately so the first load uses the new SW.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Same-origin only. Cross-origin (Exa, monday) goes straight to network.
  if (url.origin !== self.location.origin) return;

  // API: network-first, no cache. Data freshness wins.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(
            JSON.stringify({ error: "offline", message: "Network unavailable; cached data not applicable to /api/*" }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    return;
  }

  // Static shell: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const networkFetch = fetch(req)
        .then((res) => {
          // Only cache successful, basic, or cors responses. 4xx/5xx must
          // NOT poison the cache.
          if (res && res.status === 200) {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Return cached immediately; refresh in background.
        networkFetch.catch(() => {});
        return cached;
      }
      const res = await networkFetch;
      if (res) return res;
      // No cache + no network → fall through to the index.html for SPA
      // deep links (so a route reload while offline lands on the SPA shell).
      const fallback = await cache.match("/");
      if (fallback) return fallback;
      return new Response("Offline", { status: 503 });
    })(),
  );
});

// Allow the page to trigger an immediate update check.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
