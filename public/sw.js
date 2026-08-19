/**
 * sw.js — Service Worker para portfolio-website en GitHub Pages, Vercel y Local.
 *
 * Estrategia:
 *  • App Shell (HTML, JS, CSS)     → Cache First (precacheado al instalar)
 *  • Assets 3D / audio / imágenes  → Stale-While-Revalidate (cache first, actualiza en bg)
 *  • Fuentes / CDN externo         → Cache First con expiración larga
 *  • fondo.webp (51 MB)            → Network First con fallback; NO precacheado (demasiado grande)
 */

const CACHE_VERSION = 'v4';
const SHELL_CACHE   = `shell-${CACHE_VERSION}`;
const ASSET_CACHE   = `assets-${CACHE_VERSION}`;
const FONT_CACHE    = `fonts-${CACHE_VERSION}`;

// Auto-detectar la ruta base desde la ubicación del propio Service Worker
// En Vercel / Local: "" (raíz)
// En GitHub Pages: "/portfolio-website"
const BASE = self.location.pathname.replace(/\/sw\.js$/, '').replace(/\/$/, '');

// ── Archivos del App Shell (se precachean al instalar) ────────────────────────
const SHELL_URLS = [
    `${BASE}/index.html`,
    `${BASE}/`,
].filter((url, idx, selfArr) => url && selfArr.indexOf(url) === idx);

// ── Patrón de assets 3D / audio (stale-while-revalidate) ─────────────────────
const LARGE_ASSET_EXTENSIONS = /\.(glb|gltf|bin|mp3|ogg|wav|wasm)$/i;

// ── Patrón de imágenes (stale-while-revalidate) ───────────────────────────────
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|svg|ico|webp)$/i;

// ── El webp enorme nunca se precachea; se intenta red → cache ─────────────────
const HEAVY_WEBP = `${BASE}/picture/fondo.webp`;

// ─────────────────────────────────────────────────────────────────────────────
//  INSTALL — precachear el shell de forma tolerante a errores
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then(async cache => {
            for (const url of SHELL_URLS) {
                try {
                    await cache.add(url);
                } catch (err) {
                    console.warn('[SW] Precache omitido para:', url, err);
                }
            }
        }).then(() => self.skipWaiting())
    );
});

// ─────────────────────────────────────────────────────────────────────────────
//  ACTIVATE — limpiar caches viejos
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
    const validCaches = new Set([SHELL_CACHE, ASSET_CACHE, FONT_CACHE]);

    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => !validCaches.has(k)).map(k => {
                    console.log('[SW] Eliminando cache viejo:', k);
                    return caches.delete(k);
                })
            )
        ).then(() => self.clients.claim())
    );
});

// ─────────────────────────────────────────────────────────────────────────────
//  FETCH — estrategias de caching
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Solo manejar peticiones HTTP/HTTPS
    if (!url.protocol.startsWith('http')) return;

    // ── Fuentes de Google Fonts (Cache First) ─────────────────────────────
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(cacheFirst(request, FONT_CACHE));
        return;
    }

    // Solo manejar peticiones del mismo origen a partir de aquí
    if (url.origin !== self.location.origin) return;

    // ── fondo.webp grande: Network First con fallback al cache ────────────
    if (url.pathname === HEAVY_WEBP || url.pathname.endsWith('/picture/fondo.webp')) {
        event.respondWith(networkFirstWithCache(request, ASSET_CACHE));
        return;
    }

    // ── Assets 3D, audio, wasm (Stale-While-Revalidate) ──────────────────
    if (LARGE_ASSET_EXTENSIONS.test(url.pathname)) {
        event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
        return;
    }

    // ── Imágenes (Stale-While-Revalidate) ─────────────────────────────────
    if (IMAGE_EXTENSIONS.test(url.pathname)) {
        event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
        return;
    }

    // ── JS / CSS del bundle (Cache First) ────────────────────────────────
    if (url.pathname.includes('/assets/')) {
        event.respondWith(cacheFirst(request, SHELL_CACHE));
        return;
    }

    // ── Navegación HTML (Network First, fallback al shell cacheado) ───────
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match(`${BASE}/index.html`) ||
                caches.match(`${BASE}/`) ||
                caches.match('/')
            )
        );
        return;
    }

    // ── Todo lo demás: network con fallback al cache ──────────────────────
    event.respondWith(
        fetch(request).catch(() => caches.match(request))
    );
});

// ─────────────────────────────────────────────────────────────────────────────
//  ESTRATEGIAS DE CACHING
// ─────────────────────────────────────────────────────────────────────────────

/** Cache First */
async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (_) {
        return cached || new Response('Offline', { status: 503 });
    }
}

/** Stale-While-Revalidate */
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const networkPromise = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    }).catch(() => null);

    return cached || await networkPromise;
}

/** Network First */
async function networkFirstWithCache(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (_) {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response('Offline — asset no disponible', { status: 503 });
    }
}
