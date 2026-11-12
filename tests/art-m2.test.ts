import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { SetDef } from '../contracts/src/library.ts';
import { ObjectDef } from '../contracts/src/objects.ts';

/** Run 007's art for M2: the gap set, the drawer, the satchel and Wick's rope. */
const ART = fileURLToPath(new URL('../art', import.meta.url));
const json = (path: string): any => JSON.parse(readFileSync(join(ART, path), 'utf8'));
const DRAWER_PRESETS = ['kite', 'spool', 'ladder', 'odd-sock', 'brass-key'];
const MIN_BEARING_M = 0.01;

function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  expect(bytes.subarray(1, 4).toString('latin1'), `${file} is not a PNG`).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('the gap set', () => {
  const dir = join(ART, 'sets/the-gap');
  const set = json('sets/the-gap/set.json');

  test('its library fields parse as SetDef', () => {
    const { id, name, description, marks } = set;
    const result = SetDef.safeParse({ id, name, description, marks });
    expect(result.success, result.error?.message).toBe(true);
    expect(id).toBe('the-gap');
  });

  test('every mark is on the open book', () => {
    for (const { id, position } of set.marks) {
      const [x, , z] = position;
      expect(Math.abs(x), id).toBeLessThanOrEqual(0.21);
      expect(Math.abs(z), id).toBeLessThanOrEqual(0.1575);
    }
  });

  const layers: { id: string; file: string; sizePx: number[] }[] = set.layers;

  test.each(layers)('$id exists at its stated size', (layer) => {
    const file = join(dir, layer.file);
    expect(existsSync(file), layer.file).toBe(true);
    const { width, height } = pngSize(file);
    expect([width, height]).toEqual(layer.sizePx);
  });

  test('ground and effects exist', () => {
    expect(existsSync(join(dir, set.ground.file))).toBe(true);
    for (const [name, effect] of Object.entries<any>(set.effects)) {
      expect(existsSync(join(dir, effect.file)), name).toBe(true);
    }
  });

  test('the ladder rests on both rims and the sock is too short', () => {
    const { left, right, ladderSpanM } = set.gapM;
    const gap = right - left;
    expect((ladderSpanM - gap) / 2).toBeGreaterThanOrEqual(MIN_BEARING_M);
    const sock = ObjectDef.parse(json('objects/odd-sock/object.json'));
    expect(sock.size.heightM).toBeLessThan(gap);
    const ladder = ObjectDef.parse(json('objects/ladder/object.json'));
    expect(ladderSpanM).toBeLessThanOrEqual(ladder.size.heightM);
  });

  test('Pip stands on the near side and the far side is past the gap', () => {
    const mark = (id: string) => set.marks.find((m: any) => m.id === id).position[0];
    expect(mark('near-edge')).toBeGreaterThan(set.gapM.right);
    expect(mark('far-side')).toBeLessThan(set.gapM.left);
  });
});

describe('the drawer', () => {
  const drawer = json('book/drawer/drawer.json');
  const dir = join(ART, 'book/drawer');

  test.each(['tray', 'front', 'side'])('%s exists', (part) => {
    expect(existsSync(join(dir, drawer[part].file))).toBe(true);
  });

  test('its slots are exactly the five drawer presets', () => {
    expect(drawer.slots.map((s: any) => s.object).sort()).toEqual([...DRAWER_PRESETS].sort());
  });

  test('the stow fits, from the objects themselves', () => {
    const [interiorW, interiorD] = drawer.tray.interiorM;
    const planes = new Set<number>();
    for (const slot of drawer.slots) {
      const def = ObjectDef.parse(json(`objects/${slot.object}/object.json`));
      expect(slot.paintedLengthM, slot.object).toBeLessThanOrEqual(def.size.heightM);
      // Flat across the tray, then standing in its own plane.
      expect(Math.abs(slot.flatXM) + slot.paintedLengthM / 2, slot.object).toBeLessThanOrEqual(interiorW / 2);
      expect(Math.abs(slot.standXM) + slot.paintedWidthM / 2, slot.object).toBeLessThanOrEqual(interiorW / 2);
      // Flat, it lies behind its plane, from planeZM - width to planeZM.
      expect(slot.planeZM - slot.paintedWidthM, slot.object).toBeGreaterThanOrEqual(0);
      expect(slot.planeZM, slot.object).toBeLessThanOrEqual(interiorD);
      expect([1, -1]).toContain(slot.turn);
      planes.add(slot.planeZM);
    }
    expect(planes.size).toBe(drawer.slots.length);
    expect(drawer.attach.clearanceAtFullTravelM).toBeGreaterThan(0);
  });

  test('it comes out under the pull', () => {
    const book = json('book/book.json');
    expect(drawer.attach.centerX).toBeCloseTo(book.closedSizeM[0] / 2, 3);
    expect(drawer.tray.sizeM[0]).toBeLessThanOrEqual(book.closedSizeM[0]);
  });
});

describe('the satchel', () => {
  const satchel = json('satchel/satchel.json');

  test.each(['back', 'front', 'flap'])('%s exists', (part) => {
    expect(existsSync(join(ART, 'satchel', satchel.parts[part].file))).toBe(true);
  });
});

describe("Wick's rope", () => {
  const rope = ObjectDef.parse(json('objects/rope-coil/object.json'));

  test('is a rope, and not one of the drawer presets', () => {
    expect(rope.tags).toContain('rope');
    expect(DRAWER_PRESETS).not.toContain(rope.id);
  });

  test('its art exists', () => {
    expect(rope.art.kind).toBe('asset');
    if (rope.art.kind === 'asset') expect(existsSync(join(ART, rope.art.path))).toBe(true);
  });
});

test('the shared effects exist', () => {
  for (const f of ['fx/lamp-lit.png', 'fx/rope-span.png', 'fx/thread-span.png']) expect(existsSync(join(ART, f)), f).toBe(true);
});
