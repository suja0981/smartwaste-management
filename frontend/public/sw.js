/**
 * public/sw.js  —  Smart Waste PWA Service Worker
 *
 * Strategy:
 *   - Shell (HTML, JS, CSS) → Network-first, falling back to cache.
 *   - Static assets (/icons/, fonts) → Cache-first, stale-while-revalidate.
 *   - API calls (/api/, /auth/) → Network-only (never cached).
 *
 * Install: registered by app/driver/page.tsx on mount.
 */

const CACHE_NAME = "smart-waste-driver-v1"

// Shell assets to pre-cache on install
const PRECACHE_URLS = [
  "/driver",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.json",
]

// ── Install: pre-cache shell ───────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never cache API or auth calls
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) {
    return
  }

  // Static assets → cache-first
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            }
            return response
          })
      )
    )
    return
  }

  // Navigation requests → network-first, fallback to /driver cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/driver"))
    )
    return
  }

  // Everything else → network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})

// ── Push notifications (Firebase passes through firebase-messaging-sw.js) ────
// FCM is handled separately by /firebase-messaging-sw.js.
// This SW handles offline caching only.
