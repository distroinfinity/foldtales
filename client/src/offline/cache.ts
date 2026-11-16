import type { Device } from '../landing/device.ts';
import { landingSnapshot, subscribeLanding } from '../landing/landing.ts';
import { CACHE_PREFIX, COMPLETE } from './worker.ts';

/** The live site. Other origins (local builds, review links over USB) never get a worker unless asked. */
const LIVE_HOSTS = ['www.foldtales.xyz', 'foldtales.xyz'];

/** Whether this page should run the offline cache. Exported for tests. */
export function wantsOffline(options: { mode: string; off: boolean; device: Device; hostname: string; search: string }): boolean {
  if (options.off || options.mode !== 'production' || options.device !== 'headset') return false;
  // `?offline=on` tries it on a local production build. Remove it after: see the plan's notes.
  return LIVE_HOSTS.includes(options.hostname) || new URLSearchParams(options.search).get('offline') === 'on';
}

/**
 * Registers the offline cache on a headset once the book is ready, so its download never
 * competes with the cold start. A phone or desktop never gets it: they never load the book.
 * With `TT_PUBLIC_SW=off` it removes any worker an earlier build installed.
 */
export function registerOffline(device: Device): void {
  if (!('serviceWorker' in navigator)) return;
  const off = import.meta.env.TT_PUBLIC_SW === 'off';
  if (off) {
    void navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => void r.unregister()));
    return;
  }
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
