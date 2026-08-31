// =============================================================================
// SW v2 — self-unregistering no-op.
//
// The v1 SW intercepted /api/* with a "network unavailable → 503" fallback
// that broke the dossier list in v1.0.1. To ensure a clean slate, this
// version of sw.js:
//   1. Immediately unregisters itself on install
//   2. Clears all caches it might have created
//   3. Pass-through for every request (no event.respondWith)
//
// Once this is loaded by the browser, the previous v1 SW is gone. The
// W37 rebuild of a real PWA SW will bump CACHE_VERSION to v3.
// =============================================================================

self.addEventListener("install", (event) => {
  // Take over immediately so the next page load uses this SW, then unregister.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Unregister ourselves — no SW in v1
      try {
        await self.registration.unregister();
      } catch {
        // best-effort
      }
      // Purge any caches the v1 SW might have created
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        // best-effort
      }
      // Force the page to reload so it stops using the old SW's state
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const c of clients) {
          c.postMessage({ type: "RELOAD_AFTER_UNREGISTER" });
        }
      } catch {
        // best-effort
      }
      await self.clients.claim();
    })(),
  );
});

// Pass-through: do not respond to any fetch. The browser handles it normally.
self.addEventListener("fetch", () => {
  // intentionally empty — do not call event.respondWith
});
