import { Vector3 } from '@iwsdk/core';
import { describe, expect, test } from 'vitest';
import { createObjectHands, GIVE_M, NOTICE_M, restingHome } from '../client/src/objects/hands.ts';
import { playTo, playUntil, stage, type Harness } from './stage-harness.ts';

const grip = (s: Harness, who = 'pip') => s.puppets.get(who)!.grip!.getWorldPosition(new Vector3());

function hands(s: Harness) {
  return createObjectHands({
    objects: s.objects,
    runtime: s.runtime,
    book: s.view,
    drawer: s.drawer,
    satchel: s.satchel,
    stageRoot: s.root,
    sound: { play: () => undefined } as never,
    grips: () => new Map([...s.puppets].flatMap(([id, p]) => (p.grip ? [[id, p.grip] as const] : []))),
    table: () => null,
    onReadAgain: () => undefined,
    endPage: { readAgain: s.view.root, setNear: () => undefined },
  });
}

/** Grab an object through its hand target, carry it to a point, and let go there. */
function carry(s: Harness, h: ReturnType<typeof hands>, id: string, to: Vector3) {
  h.frame(s.clock.ms, true);
  const target = h.targets().find((t) => t.proxy.id === `object:${id}`);
  expect(target, `${id} can be taken`).toBeTruthy();
  const from = new Vector3(target!.proxy.position.x, target!.proxy.position.y, target!.proxy.position.z);
  target!.onGrab!('right', from);
  s.handPoints.right = from.clone();
  for (let i = 0; i <= 10; i++) {
    s.handPoints.right = from.clone().lerp(to, i / 10);
    target!.onDrag!('right', s.handPoints.right);
    s.frame(16);
    h.frame(s.clock.ms, true);
  }
  target!.onRelease!('right', to.clone());
  s.handPoints.right = null;
}

describe('handing the lantern back (P1)', () => {
  test('the lantern drops and rolls to the page edge, where a hand can take it from above', () => {
    const s = playTo(playUntil(stage(), 'lantern-drop'), 0);
    playTo(s, s.clock.ms + 3000);
    expect(s.objects.get('lantern')!.home.kind).toBe('page');
    const h = hands(s);
    h.frame(s.clock.ms, true);
    const t = h.targets().find((x) => x.proxy.id === 'object:lantern')!;
    expect(t.proxy.radiusM).toBeGreaterThanOrEqual(0.032);
    expect(t.proxy.reachUpM).toBeGreaterThanOrEqual(0.05);
  });

  test('a character notices what you hold before you let go, and reaches', () => {
    const s = playUntil(stage(), 'lantern-drop');
    playTo(s, s.clock.ms + 4000);
    const h = hands(s);
    const near = grip(s).add(new Vector3(0, 0.02, NOTICE_M * 0.7));
    h.frame(s.clock.ms, true);
    const t = h.targets().find((x) => x.proxy.id === 'object:lantern')!;
    t.onGrab!('right', new Vector3(t.proxy.position.x, t.proxy.position.y, t.proxy.position.z));
    s.handPoints.right = near;
    s.frame(16);
    h.frame(s.clock.ms, true);
    s.frame(16);
    // The glow wakes as it nears its keeper.
    expect(s.objects.get('lantern')!.home.kind).toBe('hand');
  });

  test('let go anywhere close: the lantern is taken at once, flares, and the relief beat plays', () => {
    const s = playUntil(stage(), 'lantern-drop');
    playTo(s, s.clock.ms + 4000);
    const h = hands(s);
    carry(s, h, 'lantern', grip(s).add(new Vector3(0.02, 0.01, GIVE_M * 0.6)));
    expect(s.runtime.scheduler.current().beatId).toBe('lantern-back');
    for (let i = 0; i < 120; i++) s.frame(16);
    expect(s.objects.get('lantern')!.home).toEqual({ kind: 'carried', cast: 'pip' });
    const pip = s.puppets.get('pip')!.root;
    expect(pip.getObjectByName('lantern')!.visible).toBe(true);
    expect(pip.getObjectByName('lantern#out')!.visible).toBe(false);
    expect(s.played).toContain('pleased');
  });

  test('let go far from anyone: it settles straight down, never hanging in the air', () => {
    const s = playUntil(stage(), 'lantern-drop');
    playTo(s, s.clock.ms + 4000);
    const h = hands(s);
    const over = s.view.root.localToWorld(new Vector3(0.6, 0.25, 0.1));
    carry(s, h, 'lantern', over);
    const home = s.objects.get('lantern')!.home;
    expect(home.kind).toBe('table');
    if (home.kind === 'table') expect(home.at[1]).toBe(0);
    // Nobody fetched it yet: the ask is still open.
    expect(s.runtime.scheduler.openProblem(s.clock.ms)?.id).toBe('lantern-lost');
  });

  test('left on your table, the lantern still comes back when nobody helps', () => {
    const s = playUntil(stage(), 'lantern-drop');
    playTo(s, s.clock.ms + 4000);
    carry(s, hands(s), 'lantern', s.view.root.localToWorld(new Vector3(0.5, 0.2, 0.2)));
    playUntil(s, 'wick-gone');
    expect(s.objects.get('lantern')!.home).toEqual({ kind: 'carried', cast: 'pip' });
  });
});

describe('where things come to rest', () => {
  const s = stage();
  const deps = { book: s.view, drawer: s.drawer, satchel: s.satchel, stageRoot: s.root, table: () => null };
  test('over the open page: on the page', () => {
    expect(restingHome(s.view.root.localToWorld(new Vector3(0.05, 0.2, 0)), deps, true).kind).toBe('page');
  });
  test('over the book while it is shut: on the table, not the page', () => {
    expect(restingHome(s.view.root.localToWorld(new Vector3(0.05, 0.2, 0)), deps, false).kind).toBe('table');
  });
  test('far off without a scanned table: pulled back within reach of the book', () => {
    const home = restingHome(s.view.root.localToWorld(new Vector3(2, 0.3, 0)), deps, true);
    expect(home.kind).toBe('table');
    if (home.kind === 'table') expect(Math.hypot(home.at[0], home.at[2])).toBeLessThanOrEqual(0.4501);
  });
  test('past a scanned table edge: back on the table, a little inside', () => {
    const outline = [{ x: -0.4, z: -0.4 }, { x: 0.4, z: -0.4 }, { x: 0.4, z: 0.4 }, { x: -0.4, z: 0.4 }];
    const home = restingHome(s.view.root.localToWorld(new Vector3(1, 0.3, 0)), { ...deps, table: () => outline }, true);
    expect(home.kind).toBe('table');
    if (home.kind === 'table') expect(home.at[0]).toBeLessThan(0.4);
  });
});

describe('the gap and the drawer', () => {
  test('the ask opens the drawer, and a ladder carries the traveller across', () => {
    const s = playUntil(stage(), 'gap-ask');
    for (let i = 0; i < 400; i++) s.frame(16);
    expect(s.runtime.drawerAmount).toBeCloseTo(1, 2);
    const h = hands(s);
    carry(s, h, 'ladder', grip(s).add(new Vector3(0, 0.01, 0.04)));
    expect(s.runtime.scheduler.current().beatId).toBe('cross-ladder');
    playUntil(s, 'far-side');
    const far = s.actors.get('pip')!.position.x;
    expect(far).toBeLessThan(-0.05);
  });

  test('every object comes out of the drawer standing, with something to take hold of', () => {
    const s = playUntil(stage(), 'gap-ask');
    for (let i = 0; i < 400; i++) s.frame(16);
    const h = hands(s);
    h.frame(s.clock.ms, true);
    const ids = h.targets().map((t) => t.proxy.id);
    for (const id of ['ladder', 'odd-sock', 'brass-key']) expect(ids).toContain(`object:${id}`);
  });
});

describe('when the book shuts, nothing is left in the air', () => {
  test.each(['lantern-drop', 'shore-walk', 'gap-ask', 'lighthouse', 'the-beam'])('during %s', (beat) => {
    const s = playUntil(stage(), beat);
    for (let i = 0; i < 300; i++) s.frame(16);
    // Your hands close the book; the show holds while it's shut.
    for (let i = 0; i < 120; i++) s.frame(16, Math.max(0, 1 - i / 60));
    s.root.updateMatrixWorld(true);
    const top = s.view.root.localToWorld(new Vector3(0, 0.035, 0)).y;
    const floating: string[] = [];
    s.root.traverseVisible((o) => {
      if (!(o as { isMesh?: boolean }).isMesh) return;
      // The satchel stands on the table beside the book; it's grounded, not floating.
      for (let p: typeof o | null = o; p; p = p.parent) if (p === s.satchel.root) return;
      const p = o.getWorldPosition(new Vector3());
      if (p.y > top) floating.push(o.name || o.parent?.name || '?');
    });
    expect(floating).toEqual([]);
  });
});

describe('after a crossing, what it used has settled for good', () => {
  test.each([['ladder', 'cross-ladder']])('%s', (object) => {
    const s = playUntil(stage(), 'gap-ask');
    for (let i = 0; i < 400; i++) s.frame(16);
    const h = hands(s);
    carry(s, h, object, grip(s).add(new Vector3(0, 0.01, 0.04)));
    playUntil(s, 'lighthouse');
    const home = s.objects.get(object)!.home;
    expect(home.kind).toBe('page');
    // And it is really on the page, not in the air.
    s.frame(16);
    const p = s.root.getObjectByName(`object:${object}`)!.getWorldPosition(new Vector3());
    const page = s.view.root.localToWorld(new Vector3(0, s.view.pageY, 0)).y;
    expect(p.y - page).toBeLessThan(0.01);
  });
});
