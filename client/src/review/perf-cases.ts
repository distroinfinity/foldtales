import type { RoomEffect } from '@tabletop/contracts';
import type { RoomNow } from '../room-fx/state.ts';

/**
 * The frame-rate fixtures for the Quest (lane E, task 3). Review builds only, as `?perf=<id>`.
 * Each starts chapter 1 at a beat and turns its effects on together, held for the whole session
 * (no "off"), so every 10-second telemetry window after the first reads one known state. One case
 * per page load, about 60 seconds each. Only combinations the room's rules allow are listed:
 * `tests/perf-cases.test.ts` checks each against `roomAt`.
 */
export interface PerfCase {
  id: string;
  /** Chapter 1's beat to start from (`?jump=`). */
  jump: string;
  /** Turned on together, a few seconds after the book opens, and never off. */
  hold: Array<{ effect: RoomEffect; what?: string | null; at?: string | null }>;
}

const scene = (id: string, jump: string): PerfCase => ({ id, jump, hold: [] });
const on = (...effects: RoomEffect[]): PerfCase['hold'] => effects.map((effect) => ({ effect }));

export const PERF_CASES: PerfCase[] = [
  // Chapter 1's spreads, with no effect.
  scene('ch1-lamp', 'opening'),
  scene('ch1-shore', 'the-shore'),
  scene('ch1-gap', 'to-the-edge'),
  scene('ch1-beam', 'the-beam'),
  // Each effect alone, on the shore.
  { id: 'shadows', jump: 'the-shore', hold: on('shadows') },
  { id: 'fireflies', jump: 'the-shore', hold: on('fireflies') },
  { id: 'window', jump: 'the-shore', hold: on('window') },
  { id: 'rain', jump: 'the-shore', hold: on('rain') },
  { id: 'night-sky', jump: 'the-shore', hold: on('night-sky', 'stars-lantern') },
  { id: 'snow', jump: 'the-shore', hold: on('snow') },
  { id: 'sea', jump: 'the-shore', hold: on('sea', 'boat', 'tide-in') },
  { id: 'gulls', jump: 'the-shore', hold: on('gulls') },
  { id: 'bottle', jump: 'the-shore', hold: [{ effect: 'bottle', what: 'object:bottle' }] },
  { id: 'hunt', jump: 'the-shore', hold: [{ effect: 'hunt', what: 'object:kite', at: 'room:couch' }] },
  // The heaviest combinations the rules allow: two big effects, or a big one with a small one.
  { id: 'rain+sea', jump: 'the-shore', hold: on('rain', 'sea', 'boat') },
  { id: 'rain+window', jump: 'the-shore', hold: on('rain', 'window') },
  { id: 'snow+window', jump: 'the-shore', hold: on('snow', 'window') },
  { id: 'night-sky+sea', jump: 'the-shore', hold: on('night-sky', 'sea', 'boat') },
  { id: 'sea+window', jump: 'the-shore', hold: on('sea', 'window') },
  { id: 'night-sky+fireflies', jump: 'the-shore', hold: on('night-sky', 'fireflies') },
  { id: 'rain+shadows', jump: 'the-shore', hold: on('rain', 'shadows') },
];

export const perfCase = (id: string | null): PerfCase | null => PERF_CASES.find((c) => c.id === id) ?? null;

/** Whether the room shows an effect, for checking a fixture really holds what it says. */
export function shows(now: RoomNow, effect: RoomEffect): boolean {
  switch (effect) {
    case 'rain':
    case 'snow':
      return now.weather.on && now.weather.kind === effect;
    case 'night-sky':
      return now.sky.on;
    case 'stars-lantern':
      return now.stars?.which === 'lantern';
    case 'sea':
      return now.sea.on;
    case 'boat':
      return now.boatMs !== null;
    case 'tide-in':
      return now.tide.high;
    case 'window':
      return now.window.on;
    case 'shadows':
      return now.shadows.on;
    case 'fireflies':
      return now.fireflies.on;
    case 'gulls':
      return now.gulls.on;
    case 'bottle':
      return now.bottle !== null;
    case 'hunt':
      return now.hunt !== null;
    default:
      return false;
  }
}
