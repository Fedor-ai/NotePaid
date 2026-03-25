const CACHE_NAME = 'planner-v4';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);

    // Never intercept Supabase API or auth-related requests
    if (url.hostname.includes('supabase') || url.hostname.includes('googleapis') || url.pathname.includes('/auth/')) return;

    // Never intercept auth callback URLs
    if (url.searchParams.has('code') || url.searchParams.has('token') || url.searchParams.has('error')) return;

    // Network-first for CDN (supabase-js library)
    if (url.hostname.includes('cdn.jsdelivr.net')) {
        event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
        return;
    }

    // Cache-first for app assets, with background update
    event.respondWith(
        caches.match(event.request).then(cached => {
            const fetchP = fetch(event.request).then(resp => {
                if (resp && resp.status === 200 && resp.type === 'basic') {
                    caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
                }
                return resp;
            }).catch(() => cached);
            return cached || fetchP;
        })
    );
});
