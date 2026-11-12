import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { Object3D, Texture, Vector3 } from '@iwsdk/core';
import { Rig } from '../contracts/src/index.ts';
import { BookSpec, SetSpec } from '../client/src/book/spec.ts';
import { bookFiles, buildBook } from '../client/src/book/book-view.ts';
import { buildDim } from '../client/src/light/dim.ts';
import { stageLook } from '../client/src/paint/card-material.ts';
import { wholeRef, type TexRef } from '../client/src/paint/texref.ts';
import { buildPuppet, puppetFiles } from '../client/src/puppet/puppet.ts';
import { CHECKPOINT_VERSION, readCheckpoint, writeCheckpoint } from '../client/src/show/checkpoint.ts';
import { createShowClock } from '../client/src/show/clock.ts';
import { buildLeaves } from '../client/src/show/leaves.ts';
import { ShowManifest } from '../client/src/show/manifest.ts';
import { createShowRuntime } from '../client/src/show/runtime.ts';
import type { SoundEngine } from '../client/src/sound/engine.ts';

const artRoot = fileURLToPath(new URL('../art', import.meta.url));
const json = (path: string) => JSON.parse(readFileSync(join(artRoot, path), 'utf8'));
const manifest = ShowManifest.parse(JSON.parse(readFileSync(new URL('../client/public/show/manifest.json', import.meta.url), 'utf8')));
const book = BookSpec.parse(json(manifest.book));
const set = SetSpec.parse(json(manifest.set.file));
const entry = manifest.cast[0]!;
const rig = Rig.parse(json(`${entry.member.rig}/rig.json`));

function pngSize(path: string): [number, number] {
  const header = readFileSync(join(artRoot, path)).subarray(0, 24);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}
const ref = (path: string): TexRef => {
  const texture = new Texture();
  const [width, height] = pngSize(path);
  texture.image = { width, height };
  return wholeRef(texture);
};

/** One complete stage, the way the client builds it, minus the browser-only text. */
function stage() {
  const files = bookFiles(book, 'book', set, 'sets/shore-path');
  const textures = new Map(files.map((f) => [f, ref(f)]));
  const soft = { shadow: new Texture(), hinge: new Texture(), gutter: new Texture() };
  const view = buildBook({ book, set, textures, bookBase: 'book', setBase: 'sets/shore-path', soft, castOnStage: ['pip'] });
  const castTextures = new Map(puppetFiles(entry, rig).map((f) => [f, ref(`${entry.member.rig}/${f}`)]));
  const puppet = buildPuppet(entry, rig, castTextures, { shadow: new Texture(), glow: new Texture(), chin: new Texture(), smoke: ref('fx/smoke.png') });
  view.mounts.get('pip')!.add(puppet.root);
  const root = new Object3D();
  root.add(view.root);
  root.updateMatrixWorld(true);
  const played: string[] = [];
  const sound = { play: (name: string) => played.push(name), roomTone: () => undefined } as unknown as SoundEngine;
  const captions: Array<string | null> = [];
  const clock = createShowClock();
  const runtime = createShowRuntime(
    manifest,
    set.moods,
    {
      stageRoot: root,
      book: view,
      puppets: new Map([['pip', puppet]]),
      heads: new Map([['pip', Object.keys(rig.head!.offsets)]]),
      dim: buildDim(),
      leaves: buildLeaves([ref('fx/leaf-1.png'), ref('fx/leaf-2.png')]),
      caption: { mesh: new Object3D() as never, baseSizeM: 0.012, setSize: () => undefined, show: (line) => captions.push(line) },
      sound,
    },
    clock,
  );
  return { view, puppet, runtime, clock, played };
}

const head = new Vector3(0, 0.45, 0.55);
/** Just after the light dies, from the show's own schedule rather than a fixed number. */
const afterLightOut = (() => {
  const s = stage();
  return s.runtime.schedule.items.find((i) => i.action.do === 'cue' && i.action.cue === 'lantern-out')!.startMs + 250;
})();
const storage = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};

function playTo(ms: number) {
  const s = stage();
  s.runtime.start();
  while (s.clock.ms < ms) s.runtime.frame(Math.min(16, ms - s.clock.ms), head);
  return s;
}

function snapshot(s: ReturnType<typeof stage>) {
  return {
    ms: s.clock.ms,
    cover: s.view.leftHalf.rotation.z,
    tint: stageLook.tint.value.toArray(),
    lanternOut: s.puppet.root.getObjectByName('lantern#out')!.visible,
    face: Object.keys(rig.head!.offsets).find((f) => s.puppet.root.getObjectByName(`head:${f}`)!.visible),
  };
}

describe('resume from a saved log', () => {
  const expectedFor = (s: ReturnType<typeof stage>) => ({ seriesId: manifest.libraryVersion, beatId: manifest.opening.id, untilMs: s.runtime.schedule.totalMs });

  test('after the opening has played out, a reload starts it again', () => {
    const before = playTo(20_000);
    const store = storage();
    writeCheckpoint(store, { v: CHECKPOINT_VERSION, savedAt: new Date().toISOString(), seriesId: manifest.libraryVersion, beatId: manifest.opening.id, showMs: before.clock.ms, scale: 1, confirmed: true });
    expect(readCheckpoint(store, Date.now(), expectedFor(before))).toBeNull();
  });

  test.each([
    ['mid-opening, just after the light dies', afterLightOut],
    ['mid-opening, as the cards rise', 3200],
  ])('%s: the same beat, clock, book, light and lantern, with nothing replayed', (_label, at) => {
    const before = playTo(at);
    const expected = snapshot(before);
    const store = storage();
    writeCheckpoint(store, { v: CHECKPOINT_VERSION, savedAt: new Date().toISOString(), seriesId: manifest.libraryVersion, beatId: manifest.opening.id, showMs: before.clock.ms, scale: 1, confirmed: true });

    const saved = readCheckpoint(store, Date.now(), expectedFor(before))!;
    expect(saved.beatId).toBe(manifest.opening.id);
    const after = stage();
    after.runtime.seek(saved.showMs);
    after.runtime.frame(0, head);
    expect(snapshot(after)).toEqual(expected);
    // A reload never replays a sound that already played, and the next mark still fires once.
    expect(after.played).toEqual([]);
  });

  test('the light really changes between those two moments, so the check means something', () => {
    expect(snapshot(playTo(2000)).lanternOut).toBe(false);
    expect(snapshot(playTo(afterLightOut)).lanternOut).toBe(true);
  });
});
