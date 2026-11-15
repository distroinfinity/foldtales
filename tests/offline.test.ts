import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { isOffline, precacheFor, workerSource } from '../client/vite/offline-plugin.ts';
import { wantsOffline } from '../client/src/offline/cache.ts';
import { activate, cacheName, CACHE_PREFIX, install, respond, route, sha256Hex, type Precache, type WorkerEnv } from '../client/src/offline/worker.ts';

const SCOPE = 'https://www.foldtales.xyz/';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

/** A deployed site: path to its current bytes. Swapping a value is a new deploy. */
type Site = Map<string, string>;

/** CacheStorage, in memory. Entries hold bytes, so every match is a fresh Response. */
function fakeCaches() {
  const store = new Map<string, Map<string, { body: string; type: string | null }>>();
  const caches = {
    async open(name: string) {
      if (!store.has(name)) store.set(name, new Map());
      const entries = store.get(name)!;
      return {
        async put(url: string, response: Response) {
          entries.set(url, { body: await response.text(), type: response.headers.get('content-type') });
        },
        async match(url: string) {
          const hit = entries.get(url);
          return hit ? new Response(hit.body, { headers: hit.type ? { 'content-type': hit.type } : {} }) : undefined;
        },
      };
    },
    async delete(name: string) {
      return store.delete(name);
    },
    async keys() {
      return [...store.keys()];
    },
  };
  return { caches: caches as unknown as CacheStorage, store };
}

function env(site: Site, caches: CacheStorage, fail?: (path: string) => boolean): WorkerEnv & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    caches,
    scope: SCOPE,
    digest: sha256Hex,
    fetched,
    async fetch(input) {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const path = url.pathname.slice(1);
      fetched.push(path);
      if (fail?.(path)) throw new TypeError('network down');
      const body = site.get(path);
      return body === undefined ? new Response('missing', { status: 404 }) : new Response(body, { headers: { 'content-type': 'text/plain' } });
    },
  };
}

function build(site: Site): Precache {
  const files = Object.fromEntries([...site].map(([path, body]) => [path, sha(body)]));
  return { version: sha(JSON.stringify(files)).slice(0, 16), files };
}

const request = (path: string, mode: RequestMode = 'cors') => ({ method: 'GET', url: new URL(path, SCOPE).href, mode });

async function served(e: WorkerEnv, precache: Precache, path: string, mode: RequestMode = 'cors'): Promise<string | null> {
  const key = route(precache, SCOPE, request(path, mode));
  if (!key) return null;
  return (await respond(e, precache, key, new Request(new URL(path, SCOPE)))).text();
}

const siteA = (): Site =>
  new Map([
    ['index.html', '<html>A</html>'],
    ['about/index.html', '<html>about A</html>'],
    ['assets/main-aaaa.js', 'main A'],
    ['art/sets/the-lamp/set.json', '{"set":"A"}'],
    ['art/ktx2/sets/the-lamp/ground.ktx2', 'ktx2 A'],
  ]);

describe('install', () => {
  test('caches every file of its build, checked, and marks the cache complete', async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const precache = build(site);
    await install(env(site, caches), precache);
    const cache = store.get(cacheName(precache))!;
    expect(cache.size).toBe(site.size + 1);
    expect(await served(env(site, caches), precache, 'art/sets/the-lamp/set.json')).toBe('{"set":"A"}');
  });

  test('a file from a newer deploy fails the whole install and leaves no cache', async () => {
    const site = siteA();
    const precache = build(site);
    site.set('art/sets/the-lamp/set.json', '{"set":"B"}');
    const { caches, store } = fakeCaches();
    await expect(install(env(site, caches), precache)).rejects.toThrow("isn't this build's");
    expect(store.has(cacheName(precache))).toBe(false);
  });

  test('a stale "not modified" answer is fetched again in full, and then passes', async () => {
    const site = siteA();
    const precache = build(site);
    const { caches, store } = fakeCaches();
    const e = env(site, caches);
    const network = e.fetch;
    const modes: string[] = [];
    // A date-only server's 304 hands back another build's copy from the HTTP cache.
    e.fetch = async (input, init) => {
      const path = new URL(String(input)).pathname.slice(1);
      if (path === 'art/sets/the-lamp/set.json') modes.push(String(init?.cache));
      return path === 'art/sets/the-lamp/set.json' && init?.cache === 'no-cache' ? new Response('{"set":"C"}') : network(input, init);
    };
    await install(e, precache);
    expect(modes).toEqual(['no-cache', 'reload']);
    expect(store.get(cacheName(precache))!.size).toBe(site.size + 1);
  });

  test('an interrupted install leaves no cache, and a retry starts clean', async () => {
    const site = siteA();
    const precache = build(site);
    const { caches, store } = fakeCaches();
    await expect(install(env(site, caches, (path) => path.endsWith('.ktx2')), precache)).rejects.toThrow('network down');
    expect(store.has(cacheName(precache))).toBe(false);
    await install(env(site, caches), precache);
    expect(store.get(cacheName(precache))!.size).toBe(site.size + 1);
  });

  test('a missing file fails the install', async () => {
    const site = siteA();
    const precache = build(site);
    site.delete('assets/main-aaaa.js');
    const { caches } = fakeCaches();
    await expect(install(env(site, caches), precache)).rejects.toThrow('answered 404');
  });
});

describe('an open tab on build A, while B deploys', () => {
  test('keeps serving A for stable URLs, pages included, even with B on the network', async () => {
    const site = siteA();
    const { caches } = fakeCaches();
    const a = build(site);
    await install(env(site, caches), a);
    site.set('art/sets/the-lamp/set.json', '{"set":"B"}');
    site.set('index.html', '<html>B</html>');
    const e = env(site, caches);
    expect(await served(e, a, 'art/sets/the-lamp/set.json')).toBe('{"set":"A"}');
    expect(await served(e, a, '?page=landing', 'navigate')).toBe('<html>A</html>');
    expect(e.fetched).toEqual([]);
  });

  test("B installs beside A, and A's cache goes only when B activates", async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const a = build(site);
    await install(env(site, caches), a);
    site.set('art/sets/the-lamp/set.json', '{"set":"B"}');
    const b = build(site);
    await install(env(site, caches), b);
    expect(store.has(cacheName(a)) && store.has(cacheName(b))).toBe(true);
    // The browser activates B only once no tab uses A (no skipWaiting, no claim).
    await activate(env(site, caches), b);
    expect([...store.keys()]).toEqual([cacheName(b)]);
    expect(await served(env(site, caches), b, 'art/sets/the-lamp/set.json')).toBe('{"set":"B"}');
  });

  test("B's failed install leaves A whole", async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const a = build(site);
    await install(env(site, caches), a);
    site.set('index.html', '<html>B</html>');
    const b = build(site);
    site.set('index.html', '<html>C, mid-install</html>');
    await expect(install(env(site, caches), b)).rejects.toThrow();
    expect([...store.keys()]).toEqual([cacheName(a)]);
    expect(await served(env(site, caches), a, '', 'navigate')).toBe('<html>A</html>');
  });

  test("activation keeps other apps' caches", async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    await caches.open('someone-else');
    const a = build(site);
    await install(env(site, caches), a);
    await activate(env(site, caches), a);
    expect([...store.keys()].sort()).toEqual([cacheName(a), 'someone-else'].sort());
  });
});

describe('route', () => {
  const a = build(siteA());

  test('pages by path, whatever the query', () => {
    expect(route(a, SCOPE, request('/?page=landing&jump=x', 'navigate'))).toBe(`${SCOPE}index.html`);
    expect(route(a, SCOPE, request('/about/', 'navigate'))).toBe(`${SCOPE}about/index.html`);
    expect(route(a, SCOPE, request('/about', 'navigate'))).toBe(`${SCOPE}about/index.html`);
  });

  test('leaves the network alone for what is not ours', () => {
    expect(route(a, SCOPE, { method: 'POST', url: `${SCOPE}index.html` })).toBeNull();
    expect(route(a, SCOPE, request('https://api.foldtales.xyz/healthz'))).toBeNull();
    expect(route(a, SCOPE, request('/auth/return/', 'navigate'))).toBeNull();
    expect(route(a, SCOPE, request('/link/?code=123', 'navigate'))).toBeNull();
    expect(route(a, SCOPE, request('/art/sets/the-lamp/ground.png'))).toBeNull();
    expect(route(a, SCOPE, request('/art/sets/the-lamp/set.json?v=2'))).toBeNull();
  });

  test('the kill switch routes nothing', () => {
    expect(route({ ...a, off: true }, SCOPE, request('/', 'navigate'))).toBeNull();
  });
});

describe('respond', () => {
  test('a listed file goes to the network, unstored, until the cache is complete', async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const a = build(site);
    const e = env(site, caches);
    expect(await served(e, a, 'assets/main-aaaa.js')).toBe('main A');
    expect(e.fetched).toEqual(['assets/main-aaaa.js']);
    expect(store.get(cacheName(a))?.size ?? 0).toBe(0);
  });

  test('the kill switch deletes every cache of ours', async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const a = build(site);
    await install(env(site, caches), a);
    await activate(env(site, caches), { version: 'off', files: {}, off: true });
    expect([...store.keys()].filter((name) => name.startsWith(CACHE_PREFIX))).toEqual([]);
  });
});

describe('the build side', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tt-offline-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const put = (path: string, body: string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  };

  test('lists what the book needs, and not the sign-in pages, source maps or PNG sources', () => {
    for (const path of ['index.html', 'assets/a.js', 'assets/a.js.map', 'auth/return/index.html', 'link/index.html', 'art/book/cover.png', 'art/ktx2/book/cover.ktx2', 'art/sound/m1/x.mp3', 'web/cover.webp', 'basis/basis_transcoder.wasm', '_headers', 'sw.js']) put(path, path);
    const precache = precacheFor(dir);
    expect(Object.keys(precache.files)).toEqual(['art/ktx2/book/cover.ktx2', 'art/sound/m1/x.mp3', 'assets/a.js', 'basis/basis_transcoder.wasm', 'index.html', 'web/cover.webp']);
    expect(precache.files['index.html']).toBe(sha('index.html'));
    expect(isOffline('auth/return/index.html')).toBe(false);
  });

  test('the version changes when any file changes, and only then', () => {
    const before = precacheFor(dir).version;
    expect(precacheFor(dir).version).toBe(before);
    put('art/ktx2/book/cover.ktx2', 'repainted');
    expect(precacheFor(dir).version).not.toBe(before);
  });

  test('the worker compiles on its own, with the list inlined', async () => {
    const source = await workerSource(precacheFor(dir));
    expect(source).not.toMatch(/\bimport\b|\bexport\b/);
    expect(source).toContain('foldtalesWorker.start(self, {"version"');
    expect(new Function('self', source)).toBeTypeOf('function');
  });
});

describe('who gets the worker', () => {
  const base = { mode: 'production', off: false, device: 'headset' as const, hostname: 'www.foldtales.xyz', search: '' };
  test('a headset on the live site', () => expect(wantsOffline(base)).toBe(true));
  test('never a phone or desktop, a review or dev build, or with the kill switch', () => {
    expect(wantsOffline({ ...base, device: 'elsewhere' })).toBe(false);
    expect(wantsOffline({ ...base, mode: 'review' })).toBe(false);
    expect(wantsOffline({ ...base, mode: 'development' })).toBe(false);
    expect(wantsOffline({ ...base, off: true })).toBe(false);
  });
  test('a local build only when asked', () => {
    expect(wantsOffline({ ...base, hostname: '127.0.0.1' })).toBe(false);
    expect(wantsOffline({ ...base, hostname: '127.0.0.1', search: '?offline=on' })).toBe(true);
  });
});

describe('the mute', () => {
  test('ramps a master to silence from where it is, and back to its level', async () => {
    const { rampMaster } = await import('../client/src/sound/engine.ts');
    const calls: string[] = [];
    const gain = {
      value: 0.42,
      cancelScheduledValues: (t: number) => (calls.push(`cancel ${t}`), gain),
      setValueAtTime: (v: number, t: number) => (calls.push(`hold ${v} ${t}`), gain),
      setTargetAtTime: (v: number, t: number, c: number) => (calls.push(`to ${v} ${t} ${c}`), gain),
    };
    rampMaster(gain as never, true, 3);
    rampMaster(gain as never, false, 4);
    expect(calls).toEqual(['cancel 3', 'hold 0.42 3', 'to 0 3 0.05', 'cancel 4', 'hold 0.42 4', 'to 0.9 4 0.05']);
  });
});
