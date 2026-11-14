import type { RoomEffect, StageAction } from '@tabletop/contracts';

/**
 * What the room shows at a moment of the show, worked out from the timeline alone, as the lamp is.
 * Pause, resume, a checkpoint and "Read it again" need nothing saved: the same timeline gives the
 * same room. What the reader did (fetched the kite) lives with the objects, not here.
 */

type RoomAction = Extract<StageAction, { do: 'room' }>;
interface Item {
  action: StageAction;
  startMs: number;
}

/** A lasting effect: whether it's on, and how long since it last changed, for its fade. */
export interface Lasting<K extends string = string> {
  kind: K;
  on: boolean;
  /** Since it last turned on or off, ms of show time. */
  sinceMs: number;
  at: string | null;
}

export type Weather = 'clear' | 'rain' | 'snow' | 'fog';

export interface RoomNow {
  weather: Lasting<Weather>;
  /** The latest thunder, while it rains. */
  thunderMs: number | null;
  sky: Lasting<'night'>;
  /** The constellation lit last, and since when. */
  stars: { which: 'lantern' | 'kite' | 'fox'; sinceMs: number } | null;
  shootingStarMs: number | null;
  sea: Lasting<'sea'>;
  /** 1 high, 0 low, and since when it last turned. */
  tide: { high: boolean; sinceMs: number };
  boatMs: number | null;
  bottle: { what: string; at: string | null; sinceMs: number } | null;
  shadows: Lasting<'shadows'>;
  fireflies: Lasting<'fireflies'>;
  gulls: Lasting<'gulls'>;
  window: Lasting<'window'>;
  /** The latest hunt: what was hidden, where, and since when. */
  hunt: { what: string; at: string | null; sinceMs: number } | null;
}

const off = <K extends string>(kind: K): Lasting<K> => ({ kind, on: false, sinceMs: Number.POSITIVE_INFINITY, at: null });

/** The big ones take the whole room: at most two at once, and a third ends the oldest. */
type Big = 'weather' | 'sky' | 'sea' | 'window';
const MAX_BIG = 2;

const objectOf = (ref: string | null): string | null => (ref?.startsWith('object:') ? ref.slice(7) : null);

export function roomAt(items: readonly Item[], ms: number): RoomNow {
  const now: RoomNow = {
    weather: off<Weather>('clear'),
    thunderMs: null,
    sky: off('night'),
    stars: null,
    shootingStarMs: null,
    sea: off('sea'),
    tide: { high: false, sinceMs: Number.POSITIVE_INFINITY },
    boatMs: null,
    bottle: null,
    shadows: off('shadows'),
    fireflies: off('fireflies'),
    gulls: off('gulls'),
    window: off('window'),
    hunt: null,
  };
  const started = items.filter((i): i is Item & { action: RoomAction } => i.action.do === 'room' && i.startMs <= ms).sort((a, b) => a.startMs - b.startMs);
  /** When each big effect turned on, oldest first, for the cap. */
  let bigOn: Array<{ which: Big; atMs: number }> = [];
  const lasting = (state: Lasting, on: boolean, startMs: number, at: string | null = null) => {
    if (state.on === on && (!on || state.at === at)) return;
    state.on = on;
    state.sinceMs = ms - startMs;
    state.at = at;
  };
  const turnBig = (which: Big, on: boolean, startMs: number) => {
    bigOn = bigOn.filter((b) => b.which !== which);
    if (!on) return;
    bigOn.push({ which, atMs: startMs });
    while (bigOn.length > MAX_BIG) {
      const oldest = bigOn.shift()!;
      if (oldest.which === 'weather') lasting(now.weather, false, startMs);
      if (oldest.which === 'sky') lasting(now.sky, false, startMs);
      if (oldest.which === 'sea') lasting(now.sea, false, startMs);
      if (oldest.which === 'window') lasting(now.window, false, startMs);
    }
  };

  for (const { action, startMs } of started) {
    const since = ms - startMs;
    const effect: RoomEffect = action.effect;
    switch (effect) {
      case 'rain':
      case 'snow':
      case 'fog':
        if (now.weather.kind !== effect || !now.weather.on) {
          now.weather.kind = effect;
          now.weather.on = true;
          now.weather.sinceMs = since;
        }
        // Rain and snow cover the sky: the stars go in.
        if (effect !== 'fog') {
          lasting(now.sky, false, startMs);
          turnBig('sky', false, startMs);
        }
        turnBig('weather', true, startMs);
        break;
      case 'clear':
        lasting(now.weather, false, startMs);
        turnBig('weather', false, startMs);
        break;
      case 'thunder':
        if (now.weather.on && now.weather.kind === 'rain') now.thunderMs = since;
        break;
      case 'night-sky':
        lasting(now.sky, true, startMs);
        turnBig('sky', true, startMs);
        // Stars and rain don't mix.
        if (now.weather.on && now.weather.kind !== 'fog') {
          lasting(now.weather, false, startMs);
          turnBig('weather', false, startMs);
        }
        break;
      case 'stars-lantern':
      case 'stars-kite':
      case 'stars-fox':
        if (now.sky.on) now.stars = { which: effect.slice(6) as 'lantern' | 'kite' | 'fox', sinceMs: since };
        break;
      case 'shooting-star':
        if (now.sky.on) now.shootingStarMs = since;
        break;
      case 'day':
        lasting(now.sky, false, startMs);
        turnBig('sky', false, startMs);
        now.stars = null;
        break;
      case 'sea':
        lasting(now.sea, true, startMs);
        turnBig('sea', true, startMs);
        break;
      case 'tide-in':
      case 'tide-out':
        if (now.sea.on && now.tide.high !== (effect === 'tide-in')) now.tide = { high: effect === 'tide-in', sinceMs: since };
        break;
      case 'boat':
        if (now.sea.on) now.boatMs = since;
        break;
      case 'bottle': {
        const what = objectOf(action.what);
        if (what) now.bottle = { what, at: action.at, sinceMs: since };
        break;
      }
      case 'sea-off':
        lasting(now.sea, false, startMs);
        turnBig('sea', false, startMs);
        now.boatMs = null;
        break;
      case 'shadows':
      case 'shadows-off':
        lasting(now.shadows, effect === 'shadows', startMs);
        break;
      case 'fireflies':
      case 'fireflies-off':
        lasting(now.fireflies, effect === 'fireflies', startMs);
        break;
      case 'gulls':
      case 'gulls-off':
        lasting(now.gulls, effect === 'gulls', startMs, effect === 'gulls' ? action.at : null);
        break;
      case 'window':
      case 'window-off':
        lasting(now.window, effect === 'window', startMs, effect === 'window' ? action.at : null);
        turnBig('window', effect === 'window', startMs);
        break;
      case 'hunt': {
        const what = objectOf(action.what);
        if (what) now.hunt = { what, at: action.at, sinceMs: since };
        break;
      }
    }
  }
  // Passing effects are over once they've run.
  if (now.thunderMs !== null && now.thunderMs > 2500) now.thunderMs = null;
  if (now.shootingStarMs !== null && now.shootingStarMs > 2500) now.shootingStarMs = null;
  return now;
}

/** The lasting effects on now, for the storyteller and telemetry. */
export function effectsOn(now: RoomNow): RoomEffect[] {
  const on: RoomEffect[] = [];
  if (now.weather.on && now.weather.kind !== 'clear') on.push(now.weather.kind);
  if (now.sky.on) on.push('night-sky');
  if (now.sea.on) on.push('sea');
  if (now.shadows.on) on.push('shadows');
  if (now.fireflies.on) on.push('fireflies');
  if (now.gulls.on) on.push('gulls');
  if (now.window.on) on.push('window');
  return on;
}
