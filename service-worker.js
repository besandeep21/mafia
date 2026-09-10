/**
 * Service worker for the Mafia PWA app shell.
 *
 * Per CLAUDE_PROJECT_INSTRUCTIONS.md §16 / master instructions "Persistence":
 * the PWA cache is NOT authoritative game storage — it only caches the
 * static shell (HTML/CSS/JS/icons) so the app installs cleanly and opens
 * instantly. There is no game data to cache yet since Phase 1 has no backend.
 */

const CACHE_VERSION = "mafia-shell-v2";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/styles/tokens.css",
  "./src/styles/base.css",
  "./src/styles/components.css",
  "./src/js/app.js",
  "./src/js/screens/layout.js",
  "./src/js/screens/landing.js",
  "./src/js/screens/create.js",
  "./src/js/screens/join.js",
  "./src/js/screens/lobby.js",
  "./src/js/state/roomStore.js",
  "./src/js/services/identityService.js",
  "./src/js/services/shareService.js",
  "./src/js/services/qrEncoder.js",
  "./src/js/services/qrRenderer.js",
  "./src/js/utils/roomCode.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests; let everything else (future API
  // calls to Apps Script, cross-origin font requests) pass through untouched.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
