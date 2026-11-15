/**
 * The offline cache's service worker, as plain functions so tests can drive it with fake caches.
 * `client/vite/offline-plugin.ts` compiles this file on its own (no imports) into `sw.js`, with the
 * build's file list inlined.
 *
 * Version safety: art, data and pages keep the same URL from build to build, so a cache that filled
 * itself lazily could mix two builds. This worker never does that:
 * - It installs all of its build's files at once, checking each one's SHA-256 against its list.
 *   Any mismatch (a newer deploy landed mid-install) or failure throws the whole install away.
 * - It serves only from its own complete cache, pages included, so an open tab stays on one build.
 * - A new build's worker waits until no tab uses the old one (no skipWaiting, no claim), so nothing
 *   is swapped under a running book. Only then are older caches deleted.
 * - Anything not on its list (sign-in, the API, other sites, PNG fallbacks) goes to the network
 *   untouched and is never stored.
 */

export interface Precache {
  /** A hash of the file list. One cache per version. */
  version: string;
  /** Path relative to the site root (no leading slash) to its SHA-256, in hex. */
  files: Record<string, string>;
  /** The kill switch: uninstall, delete every cache, and serve nothing. */
  off?: boolean;
}

export interface WorkerEnv {
  caches: CacheStorage;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** The site root the worker serves, ending in `/`. */
  scope: string;
  digest: (bytes: ArrayBuffer) => Promise<string>;
}

export const CACHE_PREFIX = 'foldtales-';
/** Written last, so a cache holding it is known complete. */
export const COMPLETE = '__foldtales-complete__';
const PARALLEL = 6;

export const cacheName = (precache: Precache): string => `${CACHE_PREFIX}${precache.version}`;

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Fetches and checks every file, or leaves no cache behind and throws. */
export async function install(env: WorkerEnv, precache: Precache): Promise<void> {
  if (precache.off) return;
  const name = cacheName(precache);
  // A half-filled cache from an interrupted try is never trusted: start clean.
  await env.caches.delete(name);
  const cache = await env.caches.open(name);
  const entries = Object.entries(precache.files);
  let next = 0;
  const one = async (): Promise<void> => {
    while (next < entries.length) {
      const [path, hash] = entries[next++]!;
      const url = new URL(path, env.scope).href;
      const get = async (cache: RequestCache) => {
        const response = await env.fetch(url, { cache, credentials: 'same-origin' });
        if (!response.ok) throw new Error(`${path} answered ${response.status}`);
        const bytes = await response.arrayBuffer();
        return { response, bytes, matches: (await env.digest(bytes)) === hash };
      };
      // Revalidated first, which is cheap: the page has just loaded the same files. A server that
      // validates by date alone can answer "not modified" for a different file (a rollback, a deploy
      // mid-install), so a mismatch is fetched once more in full before the install gives up.
      let got = await get('no-cache');
      if (!got.matches) got = await get('reload');
      if (!got.matches) throw new Error(`${path} isn't this build's`);
      const { response, bytes } = got;
      const type = response.headers.get('content-type');
      await cache.put(url, new Response(bytes, { headers: type ? { 'content-type': type } : {} }));
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL, entries.length) }, one));
    await cache.put(new URL(COMPLETE, env.scope).href, new Response(precache.version));
  } catch (cause) {
    await env.caches.delete(name);
    throw cause;
  }
}

/** Runs only once no tab uses an older worker. Deletes our older caches (or all of them, if off). */
export async function activate(env: WorkerEnv, precache: Precache): Promise<void> {
  const keep = precache.off ? null : cacheName(precache);
  for (const name of await env.caches.keys()) if (name.startsWith(CACHE_PREFIX) && name !== keep) await env.caches.delete(name);
}

/**
 * The cache key a request maps to, or null to leave it to the network. Synchronous, because the
 * fetch handler must decide at once whether to answer.
 */
export function route(precache: Precache, scope: string, request: { method: string; url: string; mode?: string }): string | null {
  if (precache.off || request.method !== 'GET') return null;
  const root = new URL(scope);
  const url = new URL(request.url);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return null;
  let path = decodeURIComponent(url.pathname.slice(root.pathname.length));
  if (request.mode === 'navigate') {
    // A page: its query (`?page=landing`, review links) doesn't change which file it is.
    if (path === '' || path.endsWith('/')) path += 'index.html';
    else if (!path.split('/').pop()!.includes('.')) path += '/index.html';
  } else if (url.search) return null;
  return path in precache.files ? new URL(path, root).href : null;
}

/** Answers from the complete cache. A listed file missing from it goes to the network, unstored. */
export async function respond(env: WorkerEnv, precache: Precache, key: string, request: Request): Promise<Response> {
  const cache = await env.caches.open(cacheName(precache));
  const hit = (await cache.match(new URL(COMPLETE, env.scope).href)) ? await cache.match(key) : undefined;
  return hit ?? env.fetch(request);
}

interface WorkerScope {
  registration: { scope: string; unregister(): Promise<boolean> };
  caches: CacheStorage;
  fetch: WorkerEnv['fetch'];
  skipWaiting(): Promise<void>;
  addEventListener(type: string, listener: (event: any) => void): void;
}

/** Wires the handlers. Called by the compiled `sw.js` with the inlined list. */
export function start(self: WorkerScope, precache: Precache): void {
  const env = (): WorkerEnv => ({ caches: self.caches, fetch: (input, init) => self.fetch(input, init), scope: self.registration.scope, digest: sha256Hex });
  self.addEventListener('install', (event) => {
    // The kill switch takes over at once, so a bad worker can be removed by one deploy.
    event.waitUntil(precache.off ? self.skipWaiting() : install(env(), precache));
  });
  self.addEventListener('activate', (event) => {
    event.waitUntil(activate(env(), precache).then(() => (precache.off ? self.registration.unregister().then(() => undefined) : undefined)));
  });
  if (precache.off) return;
  self.addEventListener('fetch', (event) => {
    const key = route(precache, self.registration.scope, event.request);
    if (key) event.respondWith(respond(env(), precache, key, event.request));
  });
}
