import { describe, expect, test } from 'vitest';
import { bookCached, wantsOffline } from '../client/src/offline/cache.ts';
import { rampMaster } from '../client/src/sound/engine.ts';

describe('the mute (API shapes, section 3)', () => {
  test('ramps a master to silence from where it is, and back to its level', () => {
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

describe('bookCached (API shapes, section 3)', () => {
  test('false where there is no service worker', async () => {
    expect(await bookCached()).toBe(false);
  });

  test('the worker is only for a headset on the live site, in a production build', () => {
    const base = { mode: 'production', off: false, device: 'headset' as const, hostname: 'www.foldtales.xyz', search: '' };
    expect(wantsOffline(base)).toBe(true);
    expect(wantsOffline({ ...base, device: 'elsewhere' })).toBe(false);
    expect(wantsOffline({ ...base, mode: 'review' })).toBe(false);
    expect(wantsOffline({ ...base, hostname: '127.0.0.1' })).toBe(false);
  });
});
