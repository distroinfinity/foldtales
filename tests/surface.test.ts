import { describe, expect, test } from 'vitest';
import { createPlacement, type PlacementInput } from '../client/src/stage/placement.ts';
import { fallbackSpot, horizontalForward, pickSurface, placementRays, type Hit, type Vec3 } from '../client/src/stage/surface.ts';

const head: Vec3 = { x: 0, y: 1.2, z: 0 };
const forward: Vec3 = { x: 0, y: -0.5, z: -0.87 };
const at = (x: number, y: number, z: number, normalY = 1): Hit => ({ position: { x, y, z }, normalY });
const table = (y = 0.75, z = -0.4): Hit[] => [at(-0.05, y, z), at(0, y, z), at(0.05, y, z), at(0, y, z - 0.05)];

describe('pickSurface', () => {
  test('nothing to hit', () => expect(pickSurface([], head)).toBeNull());

  test('two hits are not a surface', () => expect(pickSurface(table().slice(0, 2), head)).toBeNull());

  test('finds a table', () => expect(pickSurface(table(), head)?.y).toBe(0.75));

  test('ignores a shelf above the eyes and the floor', () => {
    expect(pickSurface(table(1.3), head)).toBeNull();
    expect(pickSurface(table(0.02), head)).toBeNull();
  });

  test('ignores walls', () => {
    expect(pickSurface(table().map((h) => ({ ...h, normalY: 0 })), head)).toBeNull();
  });

  test('takes the highest surface', () => {
    expect(pickSurface([...table(0.5), ...table(0.75)], head)?.y).toBe(0.75);
  });

  test('ignores a surface out of reach', () => {
    expect(pickSurface(table(0.75, -0.9), head)).toBeNull();
  });

  test('two separate patches at one height are not merged, and the answer is a real hit', () => {
    const left = [at(-0.45, 0.75, -0.2), at(-0.42, 0.75, -0.2), at(-0.4, 0.75, -0.2)];
    const right = [at(0.42, 0.75, -0.2), at(0.45, 0.75, -0.2)];
    const picked = pickSurface([...left, ...right], head);
    expect(left.map((h) => h.position)).toContainEqual(picked);
  });

  test('a surface too close to the eyes is refused, not moved', () => {
    const low = { x: 0, y: 1.0, z: 0 };
    expect(pickSurface(table(0.75, -0.2), low)).toBeNull();
  });

  test('on a small tray the answer is on the tray', () => {
    const tray = [at(-0.1, 0.6, -0.45), at(0, 0.6, -0.45), at(0.1, 0.6, -0.45)];
    expect(pickSurface(tray, head)).toEqual(tray[1]!.position);
  });
});

describe('fallback spot', () => {
  test('is in front of you and below your eyes', () => {
    const spot = fallbackSpot(head, forward);
    expect(spot.z).toBeCloseTo(-0.55, 2);
    expect(spot.y).toBeCloseTo(0.8, 5);
  });

  test('looking straight down still has a direction', () => {
    const f = horizontalForward({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: -1 });
    expect(f.z).toBeCloseTo(-1, 5);
    expect(f.y).toBe(0);
  });

  test('a pitched head flattens to its heading', () => {
    const f = horizontalForward({ x: 0.5, y: -0.7, z: -0.5 }, { x: 0, y: 1, z: 0 });
    expect(Math.hypot(f.x, f.z)).toBeCloseTo(1, 5);
    expect(f.x).toBeCloseTo(-f.z, 5);
  });
});

describe('the placement machine', () => {
  const see = (hits: Hit[]): PlacementInput => ({ head, forward, hits });
  const nothing = see([]);

  test('no surface reaches the fallback at exactly five seconds', () => {
    const place = createPlacement();
    expect(place.step(0, nothing).state).toBe('searching');
    expect(place.step(4999, nothing).state).toBe('searching');
    const decision = place.step(5000, nothing);
    expect(decision.state).toBe('fallback');
    expect(decision.surface).toBe('fallback');
    expect(decision.moveTo).not.toBeNull();
  });

  test('flickering hits do not delay the fallback', () => {
    const place = createPlacement();
    for (let t = 0; t < 5000; t += 100) place.step(t, t % 200 === 0 ? see(table()) : nothing);
    expect(place.step(5000, nothing).state).toBe('fallback');
  });

  test('a surface that holds half a second locks, with no fallback', () => {
    const place = createPlacement();
    expect(place.step(0, see(table())).state).toBe('searching');
    expect(place.step(499, see(table())).state).toBe('searching');
    const decision = place.step(500, see(table()));
    expect(decision).toMatchObject({ state: 'placed', surface: 'hit_test' });
    expect(decision.moveTo?.y).toBe(0.75);
    expect(place.step(6000, nothing)).toEqual({ state: 'placed', moveTo: null, surface: null });
  });

  test('a height change over 2 cm restarts the half second', () => {
    const place = createPlacement();
    place.step(0, see(table(0.75)));
    expect(place.step(400, see(table(0.72))).state).toBe('searching');
    expect(place.step(500, see(table(0.72))).state).toBe('searching');
    expect(place.step(900, see(table(0.72))).state).toBe('placed');
  });

  test('small head movement does not restart it', () => {
    const place = createPlacement();
    place.step(0, see(table(0.75, -0.4)));
    expect(place.step(500, see(table(0.75, -0.43))).state).toBe('placed');
  });

  test('a late surface moves him once, then he stays', () => {
    const place = createPlacement();
    place.step(0, nothing);
    expect(place.step(5000, nothing).state).toBe('fallback');
    expect(place.step(6000, nothing)).toEqual({ state: 'fallback', moveTo: null, surface: null });
    place.step(7000, see(table()));
    const moved = place.step(7500, see(table()));
    expect(moved).toMatchObject({ state: 'placed', surface: 'hit_test' });
    expect(place.step(9000, see(table(0.6)))).toEqual({ state: 'placed', moveTo: null, surface: null });
  });

  test('with no head pose the fallback waits, and stability does not build', () => {
    const place = createPlacement();
    const lost: PlacementInput = { head: null, forward: null, hits: table() };
    place.step(0, lost);
    expect(place.step(5000, lost).state).toBe('searching');
    expect(place.step(5100, nothing).state).toBe('fallback');
  });

  test('a new machine starts clean', () => {
    const first = createPlacement();
    first.step(0, nothing);
    first.step(5000, nothing);
    expect(createPlacement().step(5000, nothing).state).toBe('searching');
  });
});

describe('placement rays', () => {
  // Seated at a desk, looking straight ahead: eyes about 45 cm above the table.
  test.each([0.4, 0.45, 0.5])('from %s m above a table, looking ahead, every ray lands where a hit counts', (drop) => {
    const head = { x: 0, y: 0.75 + drop, z: 0 };
    for (const ray of placementRays()) {
      expect(ray.y).toBeLessThan(0);
      const t = drop / -ray.y;
      const hit = { position: { x: ray.x * t, y: 0.75, z: ray.z * t }, normalY: 1 };
      const along = Math.hypot(hit.position.x, hit.position.z);
      expect(along).toBeLessThanOrEqual(0.6);
      expect(Math.hypot(along, drop)).toBeGreaterThanOrEqual(0.5);
    }
  });

  test('enough rays to make a group, and not so many the browser refuses them', () => {
    expect(placementRays().length).toBeGreaterThanOrEqual(6);
    expect(placementRays().length).toBeLessThanOrEqual(16);
  });
});
