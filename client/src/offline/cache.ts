import type { Device } from '../landing/device.ts';
import { landingSnapshot, subscribeLanding } from '../landing/landing.ts';
import { CACHE_PREFIX, COMPLETE, RELOAD_PARAM, STALE_MESSAGE } from './worker.ts';

/** The live site. Other origins (local builds, review links over USB) never get a worker unless asked. */
const LIVE_HOSTS = ['www.foldtales.xyz', 'foldtales.xyz'];

/** Whether this page should run the offline cache. Exported for tests. */
export function wantsOffline(options: { mode: string; off: boolean; device: Device; hostname: string; search: string }): boolean {
  if (options.off || options.mode !== 'production' || options.device !== 'headset') return false;
  // `?offline=on` tries it on a local production build. Remove it after: see the plan's notes.
  return LIVE_HOSTS.includes(options.hostname) || new URLSearchParams(options.search).get('offline') === 'on';
}

/** Reloads now if the reader is on the page, or as soon as they come back to it from the book. */
function reloadWhenOnThePage(): void {
  const onThePage = () => !['inside', 'opening'].includes(landingSnapshot().kind);
  if (onThePage()) {
    location.reload();
    return;
  }
  const stop = subscribeLanding(() => {
    if (!onThePage()) return;
    stop();
    location.reload();
  });
}

/**
 * The kill switch's page side: every registration and every Foldtales cache removed, awaited,
 * then one reload if an old worker still controls this page, so nothing it cached is used again.
 */
export async function removeOffline(): Promise<void> {
  const controlled = !!navigator.serviceWorker.controller;
  await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister().catch(() => false)));
  if (typeof caches !== 'undefined') for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
  if (!controlled) return;
  let reloaded = false;
  try {
    reloaded = sessionStorage.getItem('foldtales-offline-removed') === '1';
    sessionStorage.setItem('foldtales-offline-removed', '1');
  } catch {
    // No session storage: reload anyway; the worker is gone, so the next load is uncontrolled.
  }
  if (!reloaded) reloadWhenOnThePage();
}

/**
 * Registers the offline cache on a headset once the book is ready, so its download never
 * competes with the cold start. A phone or desktop never gets it: they never load the book.
 * With `TT_PUBLIC_SW=off` it removes any worker an earlier build installed (`removeOffline`).
 */
export function registerOffline(device: Device): void {
  if (!('serviceWorker' in navigator)) return;
  const off = import.meta.env.TT_PUBLIC_SW === 'off';
  if (off) {
    void removeOffline().catch(() => undefined);
    return;
  }
  // A load the worker sent back to the network (its build had gone): tidy the address.
  const params = new URLSearchParams(location.search);
  if (params.has(RELOAD_PARAM)) {
    params.delete(RELOAD_PARAM);
    const query = params.toString();
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  }
  // The worker found its build gone from the server: it has unregistered, so a reload loads the current one whole.
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === STALE_MESSAGE) reloadWhenOnThePage();
  });
  if (!wantsOffline({ mode: import.meta.env.MODE, off, device, hostname: location.hostname, search: location.search })) return;
  const register = () => void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => undefined);
  const ready = () => ['ready', 'inside', 'refused'].includes(landingSnapshot().kind);
  if (ready()) {
    register();
    return;
  }
  const stop = subscribeLanding(() => {
    if (!ready()) return;
    stop();
    register();
  });
}

/**
 * Whether a chapter can start offline from this browser: a worker is active and holds a complete
 * cache of a build. False when there's no worker (a phone, a review build, the kill switch, or a
 * first visit still installing). Not cached: IWSDK fetches its hand and controller profiles from
 * jsdelivr, and troika its fallback glyphs, so how input looks offline is checked on the headset.
 */
export async function bookCached(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || typeof caches === 'undefined') return false;
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) return false;
    const complete = new URL(COMPLETE, registration.scope).href;
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && (await (await caches.open(name)).match(complete))) return true;
    }
    return false;
  } catch {
    return false;
  }
}
