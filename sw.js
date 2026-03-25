const CACHE_NAME = 'planner-v2';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Don't cache Supabase API calls or auth callbacks
    if (url.hostname.includes('supabase') ||
        url.hostname.includes('googleapis') ||
        url.pathname.includes('/auth/')) {
        return;
    }

    // CRITICAL: Don't intercept auth callback URLs (magic link return)
    // These contain ?code=... or #access_token=... that must reach the app
    if (url.searchParams.has('code') ||
        url.searchParams.has('token') ||
        url.searchParams.has('error') ||
        url.hash.includes('access_token')) {
        return;
    }

    // Don't cache CDN scripts (supabase-js) — let browser handle
    if (url.hostname.includes('cdn.jsdelivr.net')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for app assets
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request).then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
                }
                return response;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});
