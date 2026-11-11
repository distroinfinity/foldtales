import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { ObjectDef, TAG_VOCABULARY } from '../contracts/src/objects.ts';

const ART = fileURLToPath(new URL('../art', import.meta.url));
const OBJECTS = join(ART, 'objects');
const MIN_GRAB_M = 0.064;

/** What the gap accepts (docs/technical-design.md, Objects), and episode 1's drawer presets from run 006. */
const GAP_ACCEPTS = ['flies', 'climbs', 'spans', 'rope'];
const DRAWER = ['kite', 'spool', 'ladder', 'odd-sock', 'brass-key'];

const folders = existsSync(OBJECTS)
  ? readdirSync(OBJECTS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
  : [];
const raw = (id: string): unknown => JSON.parse(readFileSync(join(OBJECTS, id, 'object.json'), 'utf8'));
const def = (id: string) => ObjectDef.parse(raw(id));

/** Width and height from a PNG's IHDR chunk, so the test needs no image library. */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  expect(bytes.subarray(1, 4).toString('latin1'), `${file} is not a PNG`).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('art/objects', () => {
  test('there are objects, and every folder has an object.json', () => {
    expect(folders.length).toBeGreaterThan(0);
    for (const id of folders) expect(existsSync(join(OBJECTS, id, 'object.json')), id).toBe(true);
  });

  test.each(folders)('%s parses as ObjectDef', (id) => {
    const result = ObjectDef.safeParse(raw(id));
    expect(result.success, result.error?.message).toBe(true);
  });

  test.each(folders)('%s is named after its folder', (id) => {
    expect(def(id).id).toBe(id);
  });

  test.each(folders)('%s uses only tags from contracts/data/tags.json', (id) => {
    const known = new Set(TAG_VOCABULARY.map((t) => t.id));
    expect(def(id).tags.filter((tag) => !known.has(tag))).toEqual([]);
  });

  test.each(folders)('%s has its art file, inside its own folder', (id) => {
    const { art } = def(id);
    expect(art.kind).toBe('asset');
    if (art.kind !== 'asset') return;
    expect(art.path.startsWith(`objects/${id}/`), art.path).toBe(true);
    expect(existsSync(join(ART, art.path)), art.path).toBe(true);
  });

  test.each(folders)('%s is at least 64 mm to grab at reference size', (id) => {
    const { art, size } = def(id);
    if (art.kind !== 'asset') return;
    const { width, height } = pngSize(join(ART, art.path));
    const longest = Math.max(size.heightM, (size.heightM * width) / height);
    expect(longest).toBeGreaterThanOrEqual(MIN_GRAB_M);
  });
});

describe("episode 1's drawer", () => {
  test('every preset exists', () => {
    expect(DRAWER.filter((id) => !folders.includes(id))).toEqual([]);
  });

  test('the presets cover everything the gap accepts', () => {
    const tags = new Set(DRAWER.flatMap((id) => def(id).tags));
    expect(GAP_ACCEPTS.filter((tag) => !tags.has(tag))).toEqual([]);
  });

  test('at least one preset is a funny failure at the gap', () => {
    const failures = DRAWER.filter((id) => !def(id).tags.some((tag) => GAP_ACCEPTS.includes(tag)));
    expect(failures.length).toBeGreaterThan(0);
  });
});
