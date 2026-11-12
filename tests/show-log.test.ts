import { describe, expect, test } from 'vitest';
import { ShowEvent } from '../contracts/src/index.ts';
import { createShowLog, memoryLogStore } from '../client/src/show/log.ts';

const clock = { nowIso: () => '2026-11-12T10:00:00.000Z', showMs: () => 1234 };

describe('the show log', () => {
  test('every event is a valid ShowEvent, in order', async () => {
    const store = memoryLogStore();
    const log = createShowLog(store, { seriesId: 'flagship-1', episodeId: 'opening' }, clock);
    log.append('beat.started', { beatId: 'opening', fallback: null });
    log.append('session.paused', { reason: 'ribbon' });
    log.append('session.resumed', {});
    await log.flushed();
    const events = await store.all();
    expect(events.map((e) => e.type)).toEqual(['beat.started', 'session.paused', 'session.resumed']);
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2]);
    for (const event of events) expect(() => ShowEvent.parse(event)).not.toThrow();
  });

  test('a reloaded log continues its numbering', async () => {
    const store = memoryLogStore();
    const first = createShowLog(store, { seriesId: 'flagship-1', episodeId: 'opening' }, clock);
    first.append('beat.started', { beatId: 'opening', fallback: null });
    await first.flushed();
    const second = createShowLog(store, { seriesId: 'flagship-1', episodeId: 'opening' }, clock);
    second.append('beat.completed', { beatId: 'opening' });
    await second.flushed();
    expect((await store.all()).map((e) => e.seq)).toEqual([0, 1]);
  });

  test('a store that fails never stops the show', async () => {
    const log = createShowLog({ all: async () => { throw new Error('no idb'); }, put: async () => { throw new Error('no idb'); } }, { seriesId: 'flagship-1', episodeId: 'opening' }, clock);
    expect(() => log.append('session.resumed', {})).not.toThrow();
    await expect(log.flushed()).resolves.toBeUndefined();
  });
});
