import { describe, expect, test, vi } from 'vitest';
import { stageLook } from '../client/src/paint/card-material.ts';
import { CHECKPOINT_VERSION, readCheckpoint, writeCheckpoint } from '../client/src/show/checkpoint.ts';
import type { RuntimeSnapshot } from '../client/src/show/runtime.ts';
import { manifest, playTo, playUntil, spine, stage, type Harness } from './stage-harness.ts';

// These play the whole stage frame by frame: 3–10 s each on a busy machine, past vitest's 5 s
// default. A longer limit for this file only; what each test checks is unchanged.
vi.setConfig({ testTimeout: 30_000 });

const storage = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};
const expected = { seriesId: manifest.libraryVersion, episodeId: spine.id };

function save(s: Harness, store = storage()) {
  writeCheckpoint(store, { v: CHECKPOINT_VERSION, savedAt: new Date().toISOString(), seriesId: manifest.libraryVersion, episodeId: spine.id, showMs: s.clock.ms, scale: 1, confirmed: true, runtime: s.runtime.snapshot() as unknown as Record<string, unknown>, ended: s.runtime.ended });
  return store;
}

function look(s: Harness) {
  const pip = s.puppets.get('pip')!.root;
  return {
    ms: s.clock.ms,
    beat: s.runtime.scheduler.current().beatId,
    cover: s.view.leftHalf.rotation.z,
    tint: stageLook.tint.value.toArray().map((v) => Math.round(v * 1000) / 1000),
    lanternOut: pip.getObjectByName('lantern#out')!.visible,
    lanternInPaw: pip.getObjectByName('lantern')!.visible,
    lantern: s.objects.get('lantern')!.home.kind,
  };
}

function resumeFrom(store: ReturnType<typeof storage>) {
  const saved = readCheckpoint(store, Date.now(), expected)!;
  const after = stage();
  after.runtime.restore(saved.runtime as unknown as RuntimeSnapshot, saved.showMs);
  after.frame(0);
  return after;
}

describe('resume from a checkpoint', () => {
  test.each([
    ['as the cards rise', (s: Harness) => playTo(s, 3200)],
    ['just after the light dies', (s: Harness) => playUntil(s, 'lantern-drop')],
    ['while the lantern lies at the edge', (s: Harness) => playTo(playUntil(s, 'lantern-drop'), s.clock.ms + 6000)],
    ['on the shore, after the lantern came back by courage', (s: Harness) => playUntil(s, 'the-shore')],
  ])('%s: the same beat, clock, book, light and lantern, with nothing replayed', (_label, play) => {
    const before = play(stage());
    const after = resumeFrom(save(before));
    expect(look(after)).toEqual(look(before));
    expect(after.played).toEqual([]);
    expect(after.spoken).toEqual([]);
  });

  test('straight after a gift preempted a beat: the gift beat carries on, not the cut one', () => {
    const before = playUntil(stage(), 'lantern-drop');
    playTo(before, before.clock.ms + 6000);
    before.objects.send('lantern', { kind: 'hand', side: 'right' }, 0);
    expect(before.runtime.gift('lantern', 'pip')?.outcome.kind).toBe('rule');
    before.frame(16);
    const after = resumeFrom(save(before));
    expect(after.runtime.scheduler.current().beatId).toBe('lantern-back');
    for (let i = 0; i < 200; i++) {
      before.frame(16);
      after.frame(16);
    }
    expect(look(after)).toEqual(look(before));
  });

  test('a finished chapter is not resumed: it starts again', () => {
    const s = stage();
    s.runtime.start();
    s.runtime.restore({ ...s.runtime.snapshot() }, 0);
    const store = storage();
    writeCheckpoint(store, { v: CHECKPOINT_VERSION, savedAt: new Date().toISOString(), seriesId: manifest.libraryVersion, episodeId: spine.id, showMs: 400_000, scale: 1, confirmed: true, runtime: {}, ended: true });
    expect(readCheckpoint(store, Date.now(), expected)).toBeNull();
  });

  test('the light really changes between those moments, so the check means something', () => {
    expect(look(playTo(stage(), 2000)).lanternOut).toBe(false);
    expect(look(playUntil(stage(), 'lantern-drop')).lanternOut).toBe(true);
  });
});
