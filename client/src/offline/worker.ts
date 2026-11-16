/**
 * The offline cache's service worker, as plain functions so tests can drive it with fake caches.
 * `client/vite/offline-plugin.ts` compiles this file on its own (no imports) into `sw.js`, with the
 * build's file list inlined.
 *
 * Version safety: art, data and pages keep the same URL from build to build, so a cache could mix
 * two builds. This worker never serves bytes that aren't its own build's:
 * - It installs all of its build's files into a cache of its own (`foldtales-<version>-<id>`),
 *   checking each file's SHA-256 against its list. Any mismatch or failure deletes that cache only.
 *   If a complete cache of the same version already exists (a rollback, a reinstall), it's reused
 *   and nothing is deleted, so a live tab never loses its cache.
 * - It serves only from a complete cache of its version, pages included, so a tab stays on one build.
 *   A file missing from that cache is fetched and checked against the same list: if it matches, it's
 *   served and put back; if not, the site has moved on, and the worker serves nothing of the other
 *   build. It unregisters itself and asks the page to reload, so the next load is the current build,
 *   whole, from the network.
 * - A new build's worker waits until no tab uses the old one (no skipWaiting, no claim), so nothing
 *   is swapped under a running book. Only then are other versions' caches deleted.
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
  /** A fresh id for a new cache. */
  newId?: () => string;
}

export const CACHE_PREFIX = 'foldtales-';
/** Written last, so a cache holding it is known complete. */
export const COMPLETE = '__foldtales-complete__';
/** Posted to the worker's pages when its build is gone from the server: reload when it's safe. */
export const STALE_MESSAGE = 'foldtales-offline-stale';
/** On a navigation the worker had to send back to the network: don't intercept it again. */
export const RELOAD_PARAM = '__foldtales_fresh';
const PARALLEL = 6;

/** Every cache of this version starts with this. */
export const versionPrefix = (precache: Precache): string => `${CACHE_PREFIX}${precache.version}-`;

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const randomId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** A complete cache of this version, if there is one. */
export async function completeCache(env: WorkerEnv, precache: Precache): Promise<{ name: string; cache: Cache } | null> {
  const marker = new URL(COMPLETE, env.scope).href;
  for (const name of await env.caches.keys()) {
    if (!name.startsWith(versionPrefix(precache))) continue;
    const cache = await env.caches.open(name);
    if (await cache.match(marker)) return { name, cache };
  }
  return null;
}

type Checked = { kind: 'ok'; bytes: ArrayBuffer; type: string | null } | { kind: 'other-build' } | { kind: 'unreachable' };

/**
 * Fetches a listed file and checks it against the list. A date-only "not modified" gets one full
 * refetch. `other-build`: the server has different bytes, or none (404). `unreachable`: no answer
 * (offline) or a server error, which says nothing about which build is live.
 */
async function fetchChecked(env: WorkerEnv, path: string, hash: string): Promise<Checked> {
  const url = new URL(path, env.scope).href;
  for (const cache of ['no-cache', 'reload'] as const) {
    let response: Response;
    try {
      response = await env.fetch(url, { cache, credentials: 'same-origin' });
    } catch {
      return { kind: 'unreachable' };
    }
    if (response.status === 404) return { kind: 'other-build' };
    if (!response.ok) return { kind: 'unreachable' };
    const bytes = await response.arrayBuffer();
    if ((await env.digest(bytes)) === hash) return { kind: 'ok', bytes, type: response.headers.get('content-type') };
  }
  return { kind: 'other-build' };
}

const stored = (bytes: ArrayBuffer, type: string | null): Response => new Response(bytes, { headers: type ? { 'content-type': type } : {} });

/** Fills a new cache of its own with every file, checked, or deletes that cache and throws. Reuses a complete one. */
export async function install(env: WorkerEnv, precache: Precache): Promise<void> {
  if (precache.off) return;
  // A rollback or a reinstall of a build already cached: reuse it, and delete nothing.
  if (await completeCache(env, precache)) return;
  const name = `${versionPrefix(precache)}${(env.newId ?? randomId)()}`;
  const cache = await env.caches.open(name);
  const entries = Object.entries(precache.files);
  let next = 0;
  const one = async (): Promise<void> => {
    while (next < entries.length) {
      const [path, hash] = entries[next++]!;
      const got = await fetchChecked(env, path, hash);
      if (got.kind === 'other-build') throw new Error(`${path} isn't this build's`);
      if (got.kind === 'unreachable') throw new Error(`${path} couldn't be fetched`);
      await cache.put(new URL(path, env.scope).href, stored(got.bytes, got.type));
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL, entries.length) }, one));
    await cache.put(new URL(COMPLETE, env.scope).href, new Response(precache.version));
  } catch (cause) {
    // Only this attempt's own cache: never one another worker serves from.
    await env.caches.delete(name);
    throw cause;
  }
}

/**
 * Runs only once no tab uses an older worker. Keeps one complete cache of this version and deletes
 * every other cache of ours (or all of them, if off).
 */
export async function activate(env: WorkerEnv, precache: Precache): Promise<void> {
  const keep = precache.off ? null : ((await completeCache(env, precache))?.name ?? null);
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
    // Sent back to the network once already, because this worker's build is gone: leave it there.
    if (url.searchParams.has(RELOAD_PARAM)) return null;
    // A page: its query (`?page=landing`, review links) doesn't change which file it is.
    if (path === '' || path.endsWith('/')) path += 'index.html';
    else if (!path.split('/').pop()!.includes('.')) path += '/index.html';
  } else if (url.search) return null;
  return path in precache.files ? new URL(path, root).href : null;
}

/** What `respond` does when the server no longer has this worker's build. */
export interface Stale {
  /** Unregister, and tell this worker's pages to reload when it's safe. */
  (): Promise<void>;
}

/**
 * Answers from a complete cache of this version. With none (evicted, or after `stale`), every
 * request goes to the network, so nothing is mixed. A listed file missing from the cache is fetched
 * and checked against the list: served and put back if it matches; never served if it doesn't.
 */
export async function respond(env: WorkerEnv, precache: Precache, key: string, request: Request | { url: string; mode?: string }, stale: Stale): Promise<Response> {
  const complete = await completeCache(env, precache);
  if (!complete) return env.fetch(request as Request);
  const hit = await complete.cache.match(key);
  if (hit) return hit;
  const path = key.slice(new URL(env.scope).href.length);
  const got = await fetchChecked(env, path, precache.files[path]!);
  if (got.kind === 'ok') {
    await complete.cache.put(key, stored(got.bytes, got.type));
    return stored(got.bytes, got.type);
  }
  // Offline with a file lost from the cache: fail this one request, and keep the worker.
  if (got.kind === 'unreachable') return Response.error();
  // The server has moved on. Serve nothing of another build.
  await stale();
  if (request.mode === 'navigate') {
    // Load the page again, outside this worker, so it comes whole from the current build.
    const fresh = new URL(request.url);
    fresh.searchParams.set(RELOAD_PARAM, '1');
    return Response.redirect(fresh.href, 302);
  }
  return Response.error();
}

interface WorkerScope {
  registration: { scope: string; unregister(): Promise<boolean> };
  caches: CacheStorage;
  clients: { matchAll(options?: { includeUncontrolled?: boolean }): Promise<Array<{ postMessage(message: unknown): void }>> };
  fetch: WorkerEnv['fetch'];
  skipWaiting(): Promise<void>;
  addEventListener(type: string, listener: (event: any) => void): void;
}

/** Wires the handlers. Called by the compiled `sw.js` with the inlined list. */
export function start(self: WorkerScope, precache: Precache): void {
  const env = (): WorkerEnv => ({ caches: self.caches, fetch: (input, init) => self.fetch(input, init), scope: self.registration.scope, digest: sha256Hex });
  let staleOnce: Promise<void> | null = null;
  const stale: Stale = () =>
    (staleOnce ??= (async () => {
      await self.registration.unregister().catch(() => false);
      for (const client of await self.clients.matchAll({ includeUncontrolled: false })) client.postMessage({ type: STALE_MESSAGE });
    })());
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
    if (key) event.respondWith(respond(env(), precache, key, event.request, stale));
  });
}
