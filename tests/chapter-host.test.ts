import { describe, expect, it, vi } from 'vitest';
import { needsReload } from '../client/src/landing/entry.ts';
import { preparedChoice } from '../client/src/landing/library.ts';
import { carryIntoSatchel } from '../client/src/stage/carry.ts';
import { chapterManifest, prepareWithFallback } from '../client/src/stage/chapter-load.ts';
import { checkpointKey, clearCheckpoint } from '../client/src/show/checkpoint.ts';
import type { ObjectState } from '../client/src/objects/objects.ts';

describe('lane A host, chapters by number (review of PR #34)', () => {
  it('1. any destination that is not the prepared chapter reloads, Back included', () => {
    const one = { chapter: 1, ran: 'chapter' as const };
    expect(needsReload({ kind: 'chapter', n: 2, from: 'start' }, one)).toBe(true);
    expect(needsReload({ kind: 'chapter', n: 1, from: 'resume' }, one)).toBe(false);
    expect(needsReload({ kind: 'storyteller' }, one)).toBe(true);
    // Back from chapter 2 to chapter 1 on a page that prepared chapter 2, before anything ran.
    expect(needsReload({ kind: 'chapter', n: 1, from: 'resume' }, { chapter: 2, ran: null })).toBe(true);
    expect(needsReload({ kind: 'storyteller' }, { chapter: 2, ran: null })).toBe(false);
    expect(needsReload({ kind: 'chapter', n: 2, from: 'start' }, { chapter: 2, ran: 'story' })).toBe(true);
  });

  it('2. starting a chapter over clears only that chapter’s place; others and the legacy copy survive', () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    const cp = (episodeId: string) => JSON.stringify({ v: 2, savedAt: new Date().toISOString(), seriesId: 's', episodeId, showMs: 1000, scale: 1, confirmed: true, runtime: {}, ended: false });
    store.setItem('tt.checkpoint', cp('chapter-1'));
    store.setItem(checkpointKey('chapter-1'), cp('chapter-1'));
    store.setItem(checkpointKey('chapter-2'), cp('chapter-2'));
    clearCheckpoint(store, 'chapter-2');
    expect(store.getItem(checkpointKey('chapter-2'))).toBeNull();
    expect(store.getItem(checkpointKey('chapter-1'))).not.toBeNull();
    expect(store.getItem('tt.checkpoint')).not.toBeNull();
  });

  it('3. carried keepsakes already on stage move into the satchel, visible and grabbable; new ones are added', () => {
    const states: ObjectState[] = [
      { id: 'kite', home: { kind: 'away' }, given: false, grabbable: false },
      { id: 'ladder', home: { kind: 'drawer', slot: 0 } as ObjectState['home'], given: false, grabbable: true },
      { id: 'lantern', home: { kind: 'carried', cast: 'pip' }, given: false, grabbable: false },
    ];
    const r = carryIntoSatchel(states, ['kite', 'ladder', 'teapot']);
    expect(r.states.find((s) => s.id === 'kite')).toMatchObject({ home: { kind: 'satchel' }, grabbable: true });
    expect(r.states.find((s) => s.id === 'ladder')).toMatchObject({ home: { kind: 'satchel' }, grabbable: true });
    expect(r.states.find((s) => s.id === 'lantern')!.home.kind).toBe('carried');
    expect(r.reveal).toEqual(['kite', 'ladder']);
    expect(r.missing).toEqual(['teapot']);
  });

  it('4. the runtime’s opening placement is the chapter’s own', () => {
    const manifest = { onStage: [{ cast: 'pip', mark: 'lamp-left' }], other: 1 };
    const m = chapterManifest(manifest, { onStage: [{ cast: 'wick', mark: 'shore-right' }, { cast: 'moth', mark: 'sky' }] });
    expect(m.onStage).toEqual([{ cast: 'wick', mark: 'shore-right' }, { cast: 'moth', mark: 'sky' }]);
    expect(m.other).toBe(1);
    expect(manifest.onStage).toEqual([{ cast: 'pip', mark: 'lamp-left' }]);
  });

  it('5. a fallback to chapter 1 keeps its saved place and always says what failed', () => {
    expect(preparedChoice(1, true, "Chapter 2 couldn't open.")).toEqual({ label: 'Continue chapter 1', detail: "Chapter 2 couldn't open. You stopped partway through chapter 1.", resume: true });
    expect(preparedChoice(1, false, "Chapter 2 couldn't open.")).toMatchObject({ label: 'Open chapter 1', resume: false });
    expect(preparedChoice(1, false, "Chapter 2 couldn't open.").detail).toContain("Chapter 2 couldn't open.");
  });

  it('6. a failure anywhere in preparing a chapter falls back to chapter 1 once, after cleaning up', async () => {
    const order: string[] = [];
    const attempt = vi.fn(async (n: number) => {
      order.push(`attempt ${n}`);
      if (n === 2) throw new Error('art upload failed');
      return `stage ${n}`;
    });
    const r = await prepareWithFallback(2, attempt, () => order.push('clean'), () => order.push('report'));
    expect(r).toEqual({ show: 'stage 1', problem: "Chapter 2 couldn't open." });
    expect(order).toEqual(['attempt 2', 'report', 'clean', 'attempt 1']);
    // Chapter 1 itself failing is a real failure: no second try.
    const bad = vi.fn(async () => {
      throw new Error('no art');
    });
    await expect(prepareWithFallback(1, bad, () => undefined, () => undefined)).rejects.toThrow('no art');
    expect(bad).toHaveBeenCalledTimes(1);
  });
});
