/**
 * Which page this browser gets. A headset gets the book; a desktop or phone gets the same page with
 * "Send to your Quest", and never downloads the 3D. Decided in a fixed order (plan, "Device check").
 */
export type Device = 'headset' | 'elsewhere';

const HEADSET_BROWSERS = /OculusBrowser|Quest|Pico|Wolvic/i;
const PHONES = /Android|iPhone|iPad|iPod/i;
const ANSWER_WITHIN_MS = 1500;

export function forcedDevice(search: string): Device | null {
  const page = new URLSearchParams(search).get('page');
  if (page === 'landing') return 'headset';
  if (page === 'front') return 'elsewhere';
  return null;
}

export async function detectDevice(nav: Navigator = navigator, search = location.search): Promise<Device> {
  const forced = forcedDevice(search);
  if (forced) return forced;
  const ua = nav.userAgent;
  // A headset's own browser, even in its mobile mode.
  if (HEADSET_BROWSERS.test(ua)) return 'headset';
  // A phone or tablet, even one that supports AR: the book is made for hands in a headset.
  if (PHONES.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return 'elsewhere';
  // A desktop with a VR runtime (PC VR, or the IWSDK emulator in dev) can open the book.
  const xr = (nav as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
  if (!xr) return 'elsewhere';
  const supported = await Promise.race([
    xr.isSessionSupported('immersive-vr').catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ANSWER_WITHIN_MS)),
  ]);
  return supported ? 'headset' : 'elsewhere';
}
