import { describe, expect, it } from 'vitest';
import { ENTRY_TTL_MS, cancelEntry, chooseEntry, consumeEntry, pendingEntry, prepareEntry } from '../client/src/landing/entry.ts';

/** A tab's session storage: one object that survives a "reload" (a new read of the same store). */
function tab() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
}

describe('the entry target', () => {
  const now = Date.parse('2026-11-16T20:00:00Z');

  it('is kept across putting the book away and a reload, with where you were', () => {
    const s = tab();
    chooseEntry({ kind: 'storyteller' }, { kind: 'chapter', n: 1, from: 'resume' }, now, s);
    const after = pendingEntry(now + 1000, s);
    expect(after?.target).toEqual({ kind: 'storyteller' });
    expect(after?.back).toEqual({ kind: 'chapter', n: 1, from: 'resume' });
    expect(after?.state).toBe('chosen');
  });

  it('once prepared, stays for a retry until the mode has started, then is gone', () => {
    const s = tab();
    chooseEntry({ kind: 'chapter', n: 2, from: 'start' }, { kind: 'chapter', n: 1, from: 'start' }, now, s);
    prepareEntry(s);
    // XR refused: still there, still prepared, the same chapter and start.
    expect(pendingEntry(now + 5000, s)).toMatchObject({ state: 'prepared', target: { kind: 'chapter', n: 2, from: 'start' } });
    consumeEntry(s);
    expect(pendingEntry(now + 6000, s)).toBeNull();
  });

  it('Back returns where you were and forgets the choice', () => {
    const s = tab();
    chooseEntry({ kind: 'storyteller' }, { kind: 'chapter', n: 1, from: 'resume' }, now, s);
    expect(cancelEntry(s)).toEqual({ kind: 'chapter', n: 1, from: 'resume' });
    expect(pendingEntry(now, s)).toBeNull();
    expect(cancelEntry(s)).toBeNull();
  });

  it('lapses after half an hour untouched', () => {
    const s = tab();
    chooseEntry({ kind: 'storyteller' }, null, now, s);
    expect(pendingEntry(now + ENTRY_TTL_MS - 1, s)).not.toBeNull();
    expect(pendingEntry(now + ENTRY_TTL_MS + 1, s)).toBeNull();
    expect(pendingEntry(now, s)).toBeNull();
  });

  it('ignores anything that is not a choice', () => {
    const s = tab();
    s.setItem('tt.enter', '{"target":{"kind":"elsewhere"}}');
    expect(pendingEntry(now, s)).toBeNull();
    s.setItem('tt.enter', 'not json');
    expect(pendingEntry(now, s)).toBeNull();
  });
});
