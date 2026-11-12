import type { ActingId } from '@tabletop/contracts';
import type { ShowManifest } from '../show/manifest.ts';
import type { ActingOverride } from '../show/runtime.ts';

const EACH_MS = 2600;

/** Every character cycles every acting it has, then talks for a turn. Dev only. */
export function reviewOverride(manifest: ShowManifest): ActingOverride {
  const lists = new Map(manifest.cast.map((entry) => [entry.member.id, [...entry.member.acting, 'talk' as const]]));
  return (castId, ms) => {
    const list = lists.get(castId) ?? ['idle'];
    const slot = Math.floor(ms / EACH_MS);
    const pick = list[slot % list.length]!;
    const localMs = ms - slot * EACH_MS;
    if (pick === 'talk') return { acting: { acting: null, localMs, target: null }, talking: true };
    return { acting: { acting: pick as ActingId, localMs, target: 'reader' }, talking: false };
  };
}
