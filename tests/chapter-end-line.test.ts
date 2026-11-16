import { describe, expect, it } from 'vitest';
import { endLine } from '../client/src/book/text.ts';
import { hasSavedPlace, preparedChoice } from '../client/src/landing/library.ts';
import { CHECKPOINT_VERSION, writeCheckpoint } from '../client/src/show/checkpoint.ts';

describe('lane C chapter 3 pass, round 1', () => {
  it('the printed end line names the loaded chapter', () => {
    expect(endLine(3)).toBe('The end of chapter 3');
    expect(endLine(1)).toBe('The end of chapter 1');
  });

  it('leaving chapter 3 mid-way in this page load: the page offers Continue, read fresh, not Open', () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    const chapter = { seriesId: 'flagship-1', episodeId: 'chapter-3' };
    const now = Date.parse('2026-11-16T20:00:00Z');
    // At page load there was no place yet.
    expect(preparedChoice(3, hasSavedPlace(store, now, chapter), null)).toMatchObject({ label: 'Open chapter 3', resume: false });
    // Put away mid-chapter: the host writes the checkpoint.
    writeCheckpoint(store, { v: CHECKPOINT_VERSION, savedAt: new Date(now).toISOString(), seriesId: chapter.seriesId, episodeId: chapter.episodeId, showMs: 95_000, scale: 1, confirmed: true, runtime: {}, ended: false });
    expect(preparedChoice(3, hasSavedPlace(store, now + 1000, chapter), null)).toMatchObject({ label: 'Continue chapter 3', resume: true });
  });
});
