import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { isOffline, precacheFor, workerSource } from '../client/vite/offline-plugin.ts';
import { wantsOffline } from '../client/src/offline/cache.ts';
import { activate, CACHE_PREFIX, COMPLETE, install, RELOAD_PARAM, respond, route, sha256Hex, versionPrefix, type Precache, type WorkerEnv } from '../client/src/offline/worker.ts';

const SCOPE = 'https://www.foldtales.xyz/';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

/** A deployed site: path to its current bytes. Swapping a value is a new deploy. */
type Site = Map<string, string>;
type Store = Map<string, Map<string, { body: string; type: string | null }>>;

/** CacheStorage, in memory. Entries hold bytes, so every match is a fresh Response. */
function fakeCaches() {
  const store: Store = new Map();
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

let ids = 0;
function env(site: Site, caches: CacheStorage, fail?: (path: string) => boolean): WorkerEnv & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    caches,
    scope: SCOPE,
    digest: sha256Hex,
    newId: () => `i${++ids}`,
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

/** This version's caches, by name. */
const ours = (store: Store, precache: Precache) => [...store.keys()].filter((name) => name.startsWith(versionPrefix(precache)));
const theCache = (store: Store, precache: Precache) => {
  const names = ours(store, precache);
  expect(names).toHaveLength(1);
  return store.get(names[0]!)!;
};

const request = (path: string, mode: RequestMode = 'cors') => ({ method: 'GET', url: new URL(path, SCOPE).href, mode });
const noStale = async () => {
  throw new Error('went stale');
};

async function served(e: WorkerEnv, precache: Precache, path: string, mode: RequestMode = 'cors', stale = noStale): Promise<string | null> {
  const key = route(precache, SCOPE, request(path, mode));
  if (!key) return null;
  return (await respond(e, precache, key, request(path, mode), stale)).text();
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
  test('caches every file of its build in a cache of its own, checked, and marks it complete', async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const precache = build(site);
    await install(env(site, caches), precache);
    expect(theCache(store, precache).size).toBe(site.size + 1);
    expect(theCache(store, precache).has(new URL(COMPLETE, SCOPE).href)).toBe(true);
    expect(await served(env(site, caches), precache, 'art/sets/the-lamp/set.json')).toBe('{"set":"A"}');
  });

  test('a file from a newer deploy fails the whole install and leaves no cache', async () => {
    const site = siteA();
    const precache = build(site);
    site.set('art/sets/the-lamp/set.json', '{"set":"B"}');
    const { caches, store } = fakeCaches();
    await expect(install(env(site, caches), precache)).rejects.toThrow("isn't this build's");
    expect(ours(store, precache)).toEqual([]);
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
    expect(theCache(store, precache).size).toBe(site.size + 1);
  });

  test('an interrupted install leaves no cache, and a retry starts clean', async () => {
    const site = siteA();
    const precache = build(site);
    const { caches, store } = fakeCaches();
    await expect(install(env(site, caches, (path) => path.endsWith('.ktx2')), precache)).rejects.toThrow("couldn't be fetched");
    expect(ours(store, precache)).toEqual([]);
    await install(env(site, caches), precache);
    expect(theCache(store, precache).size).toBe(site.size + 1);
  });

  test('a missing file fails the install', async () => {
    const site = siteA();
    const precache = build(site);
    site.delete('assets/main-aaaa.js');
    const { caches } = fakeCaches();
    await expect(install(env(site, caches), precache)).rejects.toThrow("isn't this build's");
  });
});

describe('a rollback (Codex PR #33, point 1)', () => {
  test("reinstalling A while A is live reuses A's cache, deletes nothing and fetches nothing", async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const a = build(site);
    await install(env(site, caches), a);
    const live = ours(store, a);
    // B installs and waits; then the server rolls back to A, and every download would now fail.
    site.set('index.html', '<html>B</html>');
    const b = build(site);
    await install(env(site, caches), b);
    site.set('index.html', '<html>A</html>');
    const e = env(site, caches, () => true);
    await install(e, a);
    expect(e.fetched).toEqual([]);
    expect(ours(store, a)).toEqual(live);
    expect(await served(env(site, caches), a, '', 'navigate')).toBe('<html>A</html>');
    // A activates again: B's cache goes, A's stays.
    await activate(env(site, caches), a);
    expect([...store.keys()]).toEqual(live);
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
    expect(ours(store, a)).toHaveLength(1);
    expect(ours(store, b)).toHaveLength(1);
    // The browser activates B only once no tab uses A (no skipWaiting, no claim).
    await activate(env(site, caches), b);
    expect([...store.keys()]).toEqual(ours(store, b));
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
    expect([...store.keys()]).toEqual(ours(store, a));
    expect(await served(env(site, caches), a, '', 'navigate')).toBe('<html>A</html>');
  });

  test("activation keeps other apps' caches", async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    await caches.open('someone-else');
    const a = build(site);
    await install(env(site, caches), a);
    await activate(env(site, caches), a);
    expect([...store.keys()].sort()).toEqual([...ours(store, a), 'someone-else'].sort());
  });
});

describe('a file lost from the cache (Codex PR #33, point 2)', () => {
  const lose = (store: Store, precache: Precache, path: string) => theCache(store, precache).delete(new URL(path, SCOPE).href);

  test('with A still live: fetched, checked, served, and put back', async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const a = build(site);
    await install(env(site, caches), a);
    lose(store, a, 'art/sets/the-lamp/set.json');
    expect(await served(env(site, caches), a, 'art/sets/the-lamp/set.json')).toBe('{"set":"A"}');
    expect(theCache(store, a).has(new URL('art/sets/the-lamp/set.json', SCOPE).href)).toBe(true);
  });

  test("with B live: B's bytes are never served; the worker goes stale once", async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const a = build(site);
    await install(env(site, caches), a);
    lose(store, a, 'art/sets/the-lamp/set.json');
    lose(store, a, 'index.html');
    site.set('art/sets/the-lamp/set.json', '{"set":"B"}');
    site.set('index.html', '<html>B</html>');
    let stale = 0;
    const onStale = async () => void stale++;
    const e = env(site, caches);
    const file = await respond(e, a, `${SCOPE}art/sets/the-lamp/set.json`, request('art/sets/the-lamp/set.json'), onStale);
    expect(file.type).toBe('error');
    const page = await respond(e, a, `${SCOPE}index.html`, request('?page=landing', 'navigate'), onStale);
    expect(page.status).toBe(302);
    expect(new URL(page.headers.get('location')!).searchParams.get(RELOAD_PARAM)).toBe('1');
    expect(new URL(page.headers.get('location')!).searchParams.get('page')).toBe('landing');
    expect(stale).toBe(2);
    // What A still holds stays A.
    expect(await served(e, a, 'assets/main-aaaa.js')).toBe('main A');
  });

  test('offline: that one request fails, and the worker and its cache stay', async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const a = build(site);
    await install(env(site, caches), a);
    lose(store, a, 'art/sets/the-lamp/set.json');
    const response = await respond(env(site, caches, () => true), a, `${SCOPE}art/sets/the-lamp/set.json`, request('art/sets/the-lamp/set.json'), noStale);
    expect(response.type).toBe('error');
    expect(ours(store, a)).toHaveLength(1);
    expect(await served(env(site, caches, () => true), a, '', 'navigate')).toBe('<html>A</html>');
  });

  test('a page sent back to the network once is left to it', () => {
    expect(route(build(siteA()), SCOPE, request(`/?page=landing&${RELOAD_PARAM}=1`, 'navigate'))).toBeNull();
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
  test('with no complete cache, everything goes to the network, unstored', async () => {
    const site = siteA();
    const { caches, store } = fakeCaches();
    const a = build(site);
    const e = env(site, caches);
    expect(await served(e, a, 'assets/main-aaaa.js')).toBe('main A');
    expect(e.fetched).toEqual(['assets/main-aaaa.js']);
    expect(ours(store, a)).toEqual([]);
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
