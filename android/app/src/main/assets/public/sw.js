// Service Worker for SHALOM — True Offline-First App Shell, Complete Asset Precache & Share Target Inbox
const CACHE_NAME = 'shalom-cache-6583bcd6b3a4';
const CORE_PRECACHE_URLS = [
  /* __SHALOM_PRECACHE_START__ */
  "./",
  "./assets/index-CbKXTtb8.css",
  "./assets/index-D664CH92.js",
  "./assets/outfit-latin-400-normal-BGsTXAXT.woff2",
  "./assets/outfit-latin-400-normal-DMwTpYkH.woff",
  "./assets/outfit-latin-500-normal-ClnHRwRh.woff",
  "./assets/outfit-latin-500-normal-DKnIMDSk.woff2",
  "./assets/outfit-latin-600-normal-B7SfZ07L.woff2",
  "./assets/outfit-latin-600-normal-BEfTtDA7.woff",
  "./assets/outfit-latin-700-normal-Cu9v6i1X.woff2",
  "./assets/outfit-latin-700-normal-D4itBLBr.woff",
  "./assets/outfit-latin-800-normal-BRHLSPcU.woff",
  "./assets/outfit-latin-800-normal-CQna6-G7.woff2",
  "./assets/outfit-latin-ext-400-normal-5tcqmc2S.woff2",
  "./assets/outfit-latin-ext-400-normal-DHm7mdGe.woff",
  "./assets/outfit-latin-ext-500-normal-DrCvqoFD.woff",
  "./assets/outfit-latin-ext-500-normal-zeox_O30.woff2",
  "./assets/outfit-latin-ext-600-normal-B85nYjL1.woff2",
  "./assets/outfit-latin-ext-600-normal-CWJcPgd7.woff",
  "./assets/outfit-latin-ext-700-normal-CI4iH74K.woff2",
  "./assets/outfit-latin-ext-700-normal-fjS8-Gm7.woff",
  "./assets/outfit-latin-ext-800-normal-DRv2ic_2.woff2",
  "./assets/outfit-latin-ext-800-normal-DyhPHUt-.woff",
  "./assets/plus-jakarta-sans-latin-300-normal-n-kmFdAV.woff",
  "./assets/plus-jakarta-sans-latin-300-normal-ubitlNZx.woff2",
  "./assets/plus-jakarta-sans-latin-400-italic-BVaBttQe.woff",
  "./assets/plus-jakarta-sans-latin-400-italic-D5MFNpT-.woff2",
  "./assets/plus-jakarta-sans-latin-400-normal-BDKaGhyp.woff",
  "./assets/plus-jakarta-sans-latin-400-normal-Dhut76fR.woff2",
  "./assets/plus-jakarta-sans-latin-500-normal-Bf-nb4oT.woff2",
  "./assets/plus-jakarta-sans-latin-500-normal-DYtqi0QS.woff",
  "./assets/plus-jakarta-sans-latin-600-italic-5ssjdLIB.woff2",
  "./assets/plus-jakarta-sans-latin-600-italic-CIIWvMyh.woff",
  "./assets/plus-jakarta-sans-latin-600-normal-BR_Ojra4.woff",
  "./assets/plus-jakarta-sans-latin-600-normal-DLTa1BUW.woff2",
  "./assets/plus-jakarta-sans-latin-700-normal-CfpNZvy6.woff2",
  "./assets/plus-jakarta-sans-latin-700-normal-DqEcQeE5.woff",
  "./assets/plus-jakarta-sans-latin-ext-300-normal-LDXQZY0y.woff",
  "./assets/plus-jakarta-sans-latin-ext-300-normal-PkbsTXxT.woff2",
  "./assets/plus-jakarta-sans-latin-ext-400-italic--YfxA26p.woff2",
  "./assets/plus-jakarta-sans-latin-ext-400-italic-DO3wxI6M.woff",
  "./assets/plus-jakarta-sans-latin-ext-400-normal-2ppkqaOR.woff",
  "./assets/plus-jakarta-sans-latin-ext-400-normal-D127hM_v.woff2",
  "./assets/plus-jakarta-sans-latin-ext-500-normal-9VZagAe1.woff2",
  "./assets/plus-jakarta-sans-latin-ext-500-normal-CqEEAICU.woff",
  "./assets/plus-jakarta-sans-latin-ext-600-italic-BxoPYNsh.woff",
  "./assets/plus-jakarta-sans-latin-ext-600-italic-DmoDDd8k.woff2",
  "./assets/plus-jakarta-sans-latin-ext-600-normal-B0WRRYJ1.woff",
  "./assets/plus-jakarta-sans-latin-ext-600-normal-DQgPU_Cg.woff2",
  "./assets/plus-jakarta-sans-latin-ext-700-normal-8-d-IyIQ.woff",
  "./assets/plus-jakarta-sans-latin-ext-700-normal-BajbvANd.woff2",
  "./assets/plus-jakarta-sans-vietnamese-300-normal-BL0ZUFp7.woff",
  "./assets/plus-jakarta-sans-vietnamese-300-normal-FNv3s1Fp.woff2",
  "./assets/plus-jakarta-sans-vietnamese-400-italic-BwMUgQYW.woff",
  "./assets/plus-jakarta-sans-vietnamese-400-italic-DxHMt71w.woff2",
  "./assets/plus-jakarta-sans-vietnamese-400-normal-B8TCSmUq.woff",
  "./assets/plus-jakarta-sans-vietnamese-400-normal-Cg2kxhWu.woff2",
  "./assets/plus-jakarta-sans-vietnamese-500-normal-CvE5C8T-.woff",
  "./assets/plus-jakarta-sans-vietnamese-500-normal-DiU8zqi-.woff2",
  "./assets/plus-jakarta-sans-vietnamese-600-italic-Drv88kgW.woff2",
  "./assets/plus-jakarta-sans-vietnamese-600-italic-GVDr--YH.woff",
  "./assets/plus-jakarta-sans-vietnamese-600-normal-5YsyKbU1.woff",
  "./assets/plus-jakarta-sans-vietnamese-600-normal-Y4VTTRme.woff2",
  "./assets/plus-jakarta-sans-vietnamese-700-normal-BCh_uG_5.woff",
  "./assets/plus-jakarta-sans-vietnamese-700-normal-CV6qDkkj.woff2",
  "./assets/shalom_peace_light_1794907456870-w4u1CcKl.jpg",
  "./assets/studio_bg_dawn_sanctuary_1794916315028-DX3uAiXX.jpg",
  "./assets/studio_bg_linen_parchment_1794916316525-XGRmU0v3.jpg",
  "./assets/studio_bg_olive_light_1794916314763-BEJoLfzQ.jpg",
  "./assets/studio_bg_royal_gold_waves_1794916315803-Dyqk7CE6.jpg",
  "./icon.png",
  "./index.html",
  "./manifest.json",
  "./shalom_logo.jpg",
  "./shalom_logo_512x512.jpg",
  "./shalom_logo_512x512.png",
  "./shalom_peace_light.jpg"
  /* __SHALOM_PRECACHE_END__ */
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
    '<p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:#e2e8f0;">« L’application n’a pas encore pu enregistrer ses fichiers hors ligne pour ce premier démarrage sans connexion. Connectez-vous une fois puis SHALOM restera disponible hors ligne. »</p>' +
    '<p style="margin:0 0 18px;padding:10px 14px;border-radius:14px;background:rgba(15,37,79,0.75);border:1px solid rgba(212,175,55,0.28);font-family:Georgia,serif;font-style:italic;font-size:13px;color:#fde68a;">« Je vous laisse la paix, je vous donne ma paix. » — Jean 14:27.</p>' +
    '<div style="display:flex;flex-direction:column;gap:10px;">' +
    '<button type="button" onclick="location.reload()" style="width:100%;min-height:46px;background:linear-gradient(90deg,#c89d28,#dfb848,#c89d28);color:#071128;border:0;border-radius:12px;padding:12px 18px;font-size:13px;font-weight:800;letter-spacing:0.08em;cursor:pointer;">RÉESSAYER</button>' +
    '<button type="button" onclick="location.replace(\'./\')" style="width:100%;min-height:44px;background:rgba(255,255,255,0.08);color:#f8fafc;border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:10px 16px;font-size:12px;font-weight:700;cursor:pointer;">RETOUR À SHALOM</button>' +
    '</div>' +
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

async function fetchWithTimeout(input, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isCriticalAppAsset(urlPath) {
  return (
    urlPath === './' ||
    urlPath === './index.html' ||
    urlPath === './manifest.json' ||
    /\.(js|css)$/i.test(urlPath)
  );
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const critical = [];
  const optional = [];

  for (const url of CORE_PRECACHE_URLS) {
    if (isCriticalAppAsset(url)) critical.push(url);
    else optional.push(url);
  }

  // First ensure critical shell (HTML, JS, CSS, manifest) is safely cached
  await Promise.allSettled(
    critical.map(async (assetUrl) => {
      const resp = await fetchWithTimeout(assetUrl, { cache: 'reload' }, 12000);
      if (resp && resp.ok) {
        await cache.put(assetUrl, resp);
      }
    })
  );

  // Cache local artwork/icons without letting an optional icon stall shell install
  await Promise.allSettled(
    optional.map(async (assetUrl) => {
      const resp = await fetchWithTimeout(assetUrl, { cache: 'reload' }, 10000);
      if (resp && resp.ok) {
        await cache.put(assetUrl, resp);
      }
    })
  );
}

async function matchCachedShell(request) {
  const cache = await caches.open(CACHE_NAME);
  const direct = await cache.match(request, { ignoreSearch: true });
  if (direct) return direct;
  const indexMatch = await cache.match('./index.html');
  if (indexMatch) return indexMatch;
  const rootMatch = await cache.match('./');
  if (rootMatch) return rootMatch;

  // Fallback across any prior SHALOM cache if update is partially underway
  const globalMatch =
    (await caches.match(request, { ignoreSearch: true })) ||
    (await caches.match('./index.html')) ||
    (await caches.match('./'));
  return globalMatch || null;
}

async function revalidateNavigationInBackground(request) {
  try {
    const resp = await fetchWithTimeout(request, { cache: 'no-store' }, 4500);
    if (resp && resp.ok) {
      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html') || ct === '') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put('./index.html', resp.clone());
        await cache.put('./', resp.clone());
      }
    }
  } catch {
    // Offline or slow network: keep working seamlessly from cached shell
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name.startsWith('shalom-') && name !== CACHE_NAME) {
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

  // Preserve Android Web Share Target POST -> import shared files directly into Vault inbox
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

  // Navigation / HTML: Cache-First with silent background revalidation (never blocks startup offline/slow)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      (async () => {
        const cachedShell = await matchCachedShell(event.request);
        if (cachedShell) {
          event.waitUntil(revalidateNavigationInBackground(event.request));
          return cachedShell;
        }

        // First launch ever without cached HTML yet: try network with timeout
        try {
          const networkResp = await fetchWithTimeout(event.request, { cache: 'no-store' }, 7000);
          if (networkResp && networkResp.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put('./index.html', networkResp.clone()).catch(() => {});
            cache.put('./', networkResp.clone()).catch(() => {});
            return networkResp;
          }
        } catch {
          // Fall through to offline starter screen
        }

        return new Response(buildShalomOfflineErrorHtml(), {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      })()
    );
    return;
  }

  // Manifest: Stale-While-Revalidate
  if (url.pathname.endsWith('manifest.json')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        const netPromise = fetchWithTimeout(event.request, { cache: 'no-store' }, 5000)
          .then((res) => {
            if (res && res.ok) cache.put(event.request, res.clone());
            return res;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(netPromise);
          return cached;
        }
        return (await netPromise) || Response.error();
      })()
    );
    return;
  }

  // Static local assets (hashed JS/CSS/images/icons): Cache-First for instant offline startup
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = (await cache.match(event.request)) || (await caches.match(event.request));
      if (cached) {
        return cached;
      }

      try {
        const networkResponse = await fetchWithTimeout(event.request, {}, 8000);
        if (networkResponse && networkResponse.status === 200) {
          const ct = (networkResponse.headers.get('content-type') || '').toLowerCase();
          const isCodeRequest =
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.mjs') ||
            url.pathname.endsWith('.css');
          // Never cache HTML 404 fallback pages under a .js/.css asset key
          if (!(isCodeRequest && ct.includes('text/html'))) {
            await cache.put(event.request, networkResponse.clone());
          }
        }
        return networkResponse;
      } catch {
        const fallbackCached = await caches.match(event.request);
        return fallbackCached || Response.error();
      }
    })()
  );
});
