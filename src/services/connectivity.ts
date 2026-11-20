// Smart Offline-First Connectivity, Timeout Fetch & Deduplicated Sync Queue for SHALOM

export type ConnectivityStatus = 'online' | 'offline' | 'slow' | 'server_error';
export type ConnectivityErrorKind = 'offline' | 'slow' | 'server';

export interface ConnectivitySnapshot {
  status: ConnectivityStatus;
  isOnline: boolean;
  isSlowConnection: boolean;
  lastCheckedAt: number;
  lastErrorKind: ConnectivityErrorKind | null;
  lastErrorMessage: string | null;
  pendingCount: number;
  justReconnected: boolean;
}

export interface PendingSyncOperation {
  opKey: string;
  type: string;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
  attempts: number;
}

export class ConnectivityError extends Error {
  readonly kind: ConnectivityErrorKind;
  readonly statusCode?: number;

  constructor(kind: ConnectivityErrorKind, message: string, statusCode?: number) {
    super(message);
    this.name = 'ConnectivityError';
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

export function getUserFriendlyNetworkMessage(
  kind: ConnectivityErrorKind,
  lang: 'fr' | 'en' = 'fr',
  detail?: string
): string {
  if (kind === 'offline') {
    return lang === 'en'
      ? 'No Internet connection. This feature requires a connection.'
      : 'Pas de connexion Internet. Cette fonctionnalité nécessite une connexion.';
  }
  if (kind === 'slow') {
    return lang === 'en'
      ? 'Slow connection or request timed out. Please check your network and retry.'
      : 'Connexion trop lente ou délai expiré. Vérifiez votre réseau et réessayez.';
  }
  const suffix = detail ? ` (${detail})` : '';
  return lang === 'en'
    ? `Remote service temporarily unavailable${suffix}. Please try again shortly.`
    : `Service distant temporairement indisponible${suffix}. Vos données locales restent intactes — réessayez dans un instant.`;
}

const QUEUE_STORAGE_KEY = 'shalom_pending_sync_queue_v1';
const REACHABILITY_COOLDOWN_MS = 10_000;

type Listener = (snapshot: ConnectivitySnapshot) => void;
type QueueProcessor = (op: PendingSyncOperation) => Promise<void>;

const listeners = new Set<Listener>();
const processors = new Map<string, QueueProcessor>();

let initialized = false;
let inFlightProbe: Promise<boolean> | null = null;
let inFlightFlush: Promise<number> | null = null;
let reconnectedTimer: number | null = null;

function detectNavigatorOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function detectSlowEffectiveType(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  if (!conn) return false;
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
}

function readQueueFromStorage(): PendingSyncOperation[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueueToStorage(queue: PendingSyncOperation[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore storage quota issue
  }
}

let state: ConnectivitySnapshot = {
  status: detectNavigatorOnline() ? (detectSlowEffectiveType() ? 'slow' : 'online') : 'offline',
  isOnline: detectNavigatorOnline(),
  isSlowConnection: detectSlowEffectiveType(),
  lastCheckedAt: 0,
  lastErrorKind: null,
  lastErrorMessage: null,
  pendingCount: readQueueFromStorage().length,
  justReconnected: false,
};

function emit(): void {
  const snap = { ...state };
  listeners.forEach((cb) => {
    try {
      cb(snap);
    } catch {
      // ignore subscriber render issue
    }
  });
}

function setSnapshot(patch: Partial<ConnectivitySnapshot>): void {
  state = { ...state, ...patch };
  emit();
}

export function initConnectivityMonitor(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const onBrowserOffline = () => {
    if (reconnectedTimer !== null) {
      window.clearTimeout(reconnectedTimer);
      reconnectedTimer = null;
    }
    setSnapshot({
      status: 'offline',
      isOnline: false,
      justReconnected: false,
      lastCheckedAt: Date.now(),
    });
  };

  const onBrowserOnline = () => {
    const slow = detectSlowEffectiveType();
    setSnapshot({
      status: slow ? 'slow' : 'online',
      isOnline: true,
      isSlowConnection: slow,
      lastErrorKind: null,
      lastErrorMessage: null,
      justReconnected: true,
      lastCheckedAt: Date.now(),
    });
    if (reconnectedTimer !== null) {
      window.clearTimeout(reconnectedTimer);
    }
    reconnectedTimer = window.setTimeout(() => {
      setSnapshot({ justReconnected: false });
      reconnectedTimer = null;
    }, 4500);

    // Verify genuine reachability on recovery (throttled) and flush queued operations
    void verifyInternetReachability(true).then((ok) => {
      if (ok) {
        void flushPendingOperations();
      }
    });
  };

  window.addEventListener('offline', onBrowserOffline);
  window.addEventListener('online', onBrowserOnline);

  const conn = (navigator as unknown as {
    connection?: { addEventListener?: (t: string, cb: () => void) => void; effectiveType?: string };
  }).connection;
  if (conn && typeof conn.addEventListener === 'function') {
    conn.addEventListener('change', () => {
      const online = detectNavigatorOnline();
      const slow = detectSlowEffectiveType();
      setSnapshot({
        isOnline: online,
        isSlowConnection: slow,
        status: !online ? 'offline' : slow ? 'slow' : 'online',
      });
    });
  }
}

export function getConnectivitySnapshot(): ConnectivitySnapshot {
  initConnectivityMonitor();
  return { ...state, pendingCount: readQueueFromStorage().length };
}

export function subscribeConnectivity(listener: Listener): () => void {
  initConnectivityMonitor();
  listeners.add(listener);
  listener(getConnectivitySnapshot());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Throttled reachability check — runs ONLY on demand (never constant polling).
 */
export async function verifyInternetReachability(force = false): Promise<boolean> {
  initConnectivityMonitor();

  if (!detectNavigatorOnline()) {
    setSnapshot({
      status: 'offline',
      isOnline: false,
      lastCheckedAt: Date.now(),
    });
    return false;
  }

  const now = Date.now();
  if (!force && state.lastCheckedAt > 0 && now - state.lastCheckedAt < REACHABILITY_COOLDOWN_MS) {
    return state.isOnline;
  }

  if (inFlightProbe) return inFlightProbe;

  inFlightProbe = (async () => {
    const controller = new AbortController();
    const timer =
      typeof setTimeout !== 'undefined' ? setTimeout(() => controller.abort(), 5500) : null;
    try {
      const resp = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&meta=siteinfo&format=json&origin=*`,
        {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          signal: controller.signal,
        }
      );
      const ok = resp.ok || resp.status < 500;
      const slow = detectSlowEffectiveType();
      setSnapshot({
        status: ok ? (slow ? 'slow' : 'online') : 'server_error',
        isOnline: true,
        isSlowConnection: slow,
        lastCheckedAt: Date.now(),
        lastErrorKind: ok ? null : 'server',
        lastErrorMessage: ok ? null : `HTTP ${resp.status}`,
      });
      return ok;
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const stillBrowserOnline = detectNavigatorOnline();
      const kind: ConnectivityErrorKind = !stillBrowserOnline
        ? 'offline'
        : isAbort
          ? 'slow'
          : 'offline';
      setSnapshot({
        status: kind === 'slow' ? 'slow' : 'offline',
        isOnline: kind !== 'offline',
        isSlowConnection: kind === 'slow' || detectSlowEffectiveType(),
        lastCheckedAt: Date.now(),
        lastErrorKind: kind,
      });
      return false;
    } finally {
      if (timer !== null) clearTimeout(timer);
      inFlightProbe = null;
    }
  })();

  return inFlightProbe;
}

export interface SmartFetchOptions {
  timeoutMs?: number;
  retries?: number;
  serviceName?: string;
  lang?: 'fr' | 'en';
  skipOfflinePrecheck?: boolean;
}

export async function smartFetch(
  url: string,
  init: RequestInit = {},
  options: SmartFetchOptions = {}
): Promise<Response> {
  initConnectivityMonitor();

  const {
    timeoutMs = 10_000,
    retries = 1,
    serviceName,
    lang = 'fr',
    skipOfflinePrecheck = false,
  } = options;

  const isLocalAssetUrl =
    url.startsWith('./') || url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:');

  if (!skipOfflinePrecheck && !isLocalAssetUrl && !detectNavigatorOnline()) {
    setSnapshot({
      status: 'offline',
      isOnline: false,
      lastErrorKind: 'offline',
      lastErrorMessage: getUserFriendlyNetworkMessage('offline', lang),
      lastCheckedAt: Date.now(),
    });
    throw new ConnectivityError('offline', getUserFriendlyNetworkMessage('offline', lang));
  }

  let lastErr: ConnectivityError | null = null;
  const maxAttempts = Math.max(1, retries + 1);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer =
      typeof setTimeout !== 'undefined' ? setTimeout(() => controller.abort(), timeoutMs) : null;

    // Link optional external signal
    const externalSignal = init.signal;
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const resp = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (resp.status >= 500 || resp.status === 429) {
        const msg = getUserFriendlyNetworkMessage(
          'server',
          lang,
          serviceName ? `${serviceName} · HTTP ${resp.status}` : `HTTP ${resp.status}`
        );
        lastErr = new ConnectivityError('server', msg, resp.status);
        if (attempt + 1 < maxAttempts) continue;
        setSnapshot({
          status: 'server_error',
          isOnline: detectNavigatorOnline(),
          lastErrorKind: 'server',
          lastErrorMessage: msg,
          lastCheckedAt: Date.now(),
        });
        throw lastErr;
      }

      // Healthy network response
      const slow = detectSlowEffectiveType();
      setSnapshot({
        status: slow ? 'slow' : 'online',
        isOnline: true,
        isSlowConnection: slow,
        lastErrorKind: null,
        lastErrorMessage: null,
        lastCheckedAt: Date.now(),
      });
      return resp;
    } catch (err) {
      if (err instanceof ConnectivityError) {
        throw err;
      }
      if (externalSignal?.aborted) {
        throw err;
      }

      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort) {
        const msg = getUserFriendlyNetworkMessage('slow', lang);
        lastErr = new ConnectivityError('slow', msg);
        if (attempt + 1 < maxAttempts) continue;
        setSnapshot({
          status: 'slow',
          isOnline: detectNavigatorOnline(),
          isSlowConnection: true,
          lastErrorKind: 'slow',
          lastErrorMessage: msg,
          lastCheckedAt: Date.now(),
        });
        throw lastErr;
      }

      // Network / DNS / CORS failure
      const browserOnline = detectNavigatorOnline();
      if (!browserOnline) {
        const msg = getUserFriendlyNetworkMessage('offline', lang);
        setSnapshot({
          status: 'offline',
          isOnline: false,
          lastErrorKind: 'offline',
          lastErrorMessage: msg,
          lastCheckedAt: Date.now(),
        });
        throw new ConnectivityError('offline', msg);
      }

      // Browser says online, check whether internet actually responds before blaming server
      if (attempt + 1 < maxAttempts) continue;
      const msg = getUserFriendlyNetworkMessage(
        'server',
        lang,
        serviceName || (err instanceof Error ? err.message : undefined)
      );
      lastErr = new ConnectivityError('server', msg);
      setSnapshot({
        status: 'server_error',
        isOnline: true,
        lastErrorKind: 'server',
        lastErrorMessage: msg,
        lastCheckedAt: Date.now(),
      });
      throw lastErr;
    } finally {
      if (timer !== null) clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  throw lastErr || new ConnectivityError('server', getUserFriendlyNetworkMessage('server', lang));
}

export function classifyConnectivityError(
  err: unknown,
  lang: 'fr' | 'en' = 'fr'
): { kind: ConnectivityErrorKind; message: string } {
  if (err instanceof ConnectivityError) {
    return { kind: err.kind, message: err.message };
  }
  if (!detectNavigatorOnline()) {
    return { kind: 'offline', message: getUserFriendlyNetworkMessage('offline', lang) };
  }
  const raw = err instanceof Error ? `${err.name} ${err.message}` : String(err || '');
  if (/AbortError|timeout|timed out|expiré/i.test(raw)) {
    return { kind: 'slow', message: getUserFriendlyNetworkMessage('slow', lang) };
  }
  if (/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED|Load failed/i.test(raw)) {
    return {
      kind: 'server',
      message: getUserFriendlyNetworkMessage('server', lang),
    };
  }
  return {
    kind: 'server',
    message: getUserFriendlyNetworkMessage('server', lang, raw ? raw.slice(0, 80) : undefined),
  };
}

// =========================================================================
// PERSISTENT DEDUPLICATED OFFLINE OPERATION QUEUE
// =========================================================================

export function enqueuePendingOperation(opKey: string, type: string, payload: unknown): void {
  const queue = readQueueFromStorage();
  const now = new Date().toISOString();
  const existingIdx = queue.findIndex((item) => item.opKey === opKey);
  if (existingIdx >= 0) {
    queue[existingIdx] = {
      ...queue[existingIdx],
      type,
      payload,
      updatedAt: now,
    };
  } else {
    queue.push({
      opKey,
      type,
      payload,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    });
  }
  writeQueueToStorage(queue);
  setSnapshot({ pendingCount: queue.length });
}

export function getPendingOperations(): PendingSyncOperation[] {
  return readQueueFromStorage();
}

export function removePendingOperation(opKey: string): void {
  const next = readQueueFromStorage().filter((item) => item.opKey !== opKey);
  writeQueueToStorage(next);
  setSnapshot({ pendingCount: next.length });
}

export function clearPendingOperations(): void {
  writeQueueToStorage([]);
  setSnapshot({ pendingCount: 0 });
}

export function registerPendingProcessor(type: string, handler: QueueProcessor): void {
  processors.set(type, handler);
}

export async function flushPendingOperations(): Promise<number> {
  if (!detectNavigatorOnline()) return 0;
  if (inFlightFlush) return inFlightFlush;

  inFlightFlush = (async () => {
    const queue = readQueueFromStorage();
    if (queue.length === 0) return 0;

    let processed = 0;
    const remaining: PendingSyncOperation[] = [];

    for (const op of queue) {
      const handler = processors.get(op.type);
      if (!handler) {
        remaining.push(op);
        continue;
      }
      try {
        await handler(op);
        processed += 1;
      } catch (err) {
        if (err instanceof ConnectivityError && err.kind === 'offline') {
          remaining.push(op);
        } else if (op.attempts < 5) {
          remaining.push({ ...op, attempts: op.attempts + 1, updatedAt: new Date().toISOString() });
        }
      }
    }

    writeQueueToStorage(remaining);
    setSnapshot({ pendingCount: remaining.length });
    return processed;
  })();

  try {
    return await inFlightFlush;
  } finally {
    inFlightFlush = null;
  }
}
