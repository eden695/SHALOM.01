// Service Worker for SHALOM - Offline Christian Companion, Share Target Inbox & Safe Error Fallback
const CACHE_NAME = 'shalom-cache-v15';
const ASSETS_TO_CACHE = [
  './shalom_logo.jpg',
  './shalom_peace_light.jpg',
  './shalom_logo_512x512.png',
  './shalom_logo_512x512.jpg',
  './icon.png',
  './manifest.json',
];

const SHARE_INBOX_DB = 'shalom_share_target_db';
const SHARE_INBOX_STORE = 'pending_shares';

function buildShalomOfflineErrorHtml() {
  return (
    '<!doctype html><html lang="fr"><head><meta charset="utf-8"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<title>SHALOM — Un instant de paix…</title></head>' +
    '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:radial-gradient(circle at 50% 25%, #13294b 0%, #071128 60%, #040916 100%);color:#ffffff;text-align:center;">' +
    '<div style="max-width:400px;width:100%;background:rgba(10,23,51,0.92);border:1px solid rgba(212,175,55,0.35);border-radius:24px;padding:28px;box-shadow:0 24px 64px rgba(0,0,0,0.65);">' +
    '<img src="./shalom_logo.jpg" alt="SHALOM" style="width:72px;height:72px;border-radius:16px;object-fit:cover;border:2px solid rgba(212,175,55,0.65);margin:0 auto 12px;display:block;"/>' +
    '<h1 style="margin:0 0 4px;font-size:24px;font-weight:800;letter-spacing:0.2em;color:#f4d778;">SHALOM</h1>' +
    '<p style="margin:0 0 16px;font-size:14px;font-style:italic;color:#dbeafe;">« Un instant de paix… »</p>' +
    '<img src="./shalom_peace_light.jpg" alt="" onerror="this.style.display=\'none\'" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:14px;border:1px solid rgba(255,255,255,0.12);margin-bottom:16px;"/>' +
    '<p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:#e2e8f0;">« Nous n\'arrivons pas à établir la connexion pour le moment. Vérifiez votre connexion Internet et réessayez dans quelques instants. »</p>' +
    '<p style="margin:0 0 18px;padding:10px 14px;border-radius:14px;background:rgba(15,37,79,0.75);border:1px solid rgba(212,175,55,0.28);font-family:Georgia,serif;font-style:italic;font-size:13px;color:#fde68a;">« Je vous laisse la paix, je vous donne ma paix. » — Jean 14:27.</p>' +
    '<button type="button" onclick="location.reload()" style="width:100%;min-height:46px;background:linear-gradient(90deg,#c89d28,#dfb848,#c89d28);color:#071128;border:0;border-radius:12px;padding:12px 18px;font-size:13px;font-weight:800;letter-spacing:0.08em;cursor:pointer;">RÉESSAYER</button>' +
    '</div></body></html>'
  );
}

async function storeSharedFilesInInbox(files) {
  if (!files || files.length === 0) return;
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_INBOX_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(SHARE_INBOX_STORE)) {
        req.result.createObjectStore(SHARE_INBOX_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const items = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f || typeof f.arrayBuffer !== 'function') continue;
    const buffer = await f.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) continue;
    items.push({
      id: `share_${Date.now()}_${i}`,
      fileName: f.name || `document_partage_${i + 1}`,
      mimeType: f.type || 'application/octet-stream',
      buffer,
      receivedAt: new Date().toISOString(),
    });
  }

  if (items.length > 0) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SHARE_INBOX_STORE, 'readwrite');
      const store = tx.objectStore(SHARE_INBOX_STORE);
      items.forEach((it) => store.put(it));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Pre-cache skipped:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
          return Promise.resolve(false);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) return;

  // Handle Android Web Share Target POST -> import shared files directly into Vault inbox
  if (event.request.method === 'POST' && url.searchParams.has('share-target')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const sharedFiles = formData.getAll('files').filter((v) => v && typeof v !== 'string');
          await storeSharedFilesInInbox(sharedFiles);
        } catch (err) {
          console.warn('Share Target read warning:', err);
        }
        return Response.redirect('./?tab=vault&shared=1', 303);
      })()
    );
    return;
  }

  if (event.request.method !== 'GET') return;

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/@vite') ||
    url.pathname.includes('/@react-refresh') ||
    url.pathname.includes('/src/') ||
    url.pathname.includes('/node_modules/')
  ) {
    return;
  }

  // Always let navigation / HTML fetch live from network first, fallback to cache for offline mode,
  // and render custom SHALOM error page ONLY when both network AND cache are unavailable.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
        return new Response(buildShalomOfflineErrorHtml(), {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      })
    );
    return;
  }

  const fetchOptions = url.pathname.endsWith('manifest.json') ? { cache: 'no-store' } : {};

  event.respondWith(
    fetch(event.request, fetchOptions)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || Response.error();
      })
  );
});
