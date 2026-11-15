import { describe, expect, it } from 'vitest';
import type { ShowEvent } from '@tabletop/contracts';
import { keptNames, readCollection } from '../client/src/landing/collection.ts';

const ev = (seq: number, type: string, data: unknown): ShowEvent => ({ id: `e${seq}`, seq, type, data, at: '2026-11-16T00:00:00.000Z', showMs: 0, seriesId: 's', episodeId: 'chapter-1' }) as unknown as ShowEvent;
const keep = (seq: number, id: string, name: string) => ev(seq, 'canon.recorded', { entry: { id: `keep--${id}`, kind: 'keepsake', text: `The Reader kept the ${name}.`, episodeId: 'chapter-1', sourceEventId: `keep=${id}` } });
const page = (seq: number, keepsakes: string[]) => ev(seq, 'page.composed', { page: { episodeId: 'chapter-1', title: 't', text: [], art: [], keepsakes } });

describe('what you have kept', () => {
  it('names the latest page’s keepsakes, less anything given back', () => {
    const events = [keep(1, 'kite', 'red kite'), keep(2, 'spool', 'spool of thread'), page(3, ['kite', 'spool']), ev(4, 'canon.reverted', { entryId: 'keep--spool' })];
    expect(keptNames(events)).toEqual(['red kite']);
    expect(keptNames([])).toEqual([]);
  });

  it('tells "nothing kept" from "couldn’t read", store by store', async () => {
    const empty = await readCollection({ log: async () => ({ ok: true, value: [] }), painted: async () => ({ ok: true, items: [] }) });
    expect(empty).toEqual({ chapters: [], painted: [] });
    const half = await readCollection({ log: async () => ({ ok: false }), painted: async () => ({ ok: true, items: [{ id: 'p', name: 'Dragon kite' }] }) });
    expect(half).toEqual({ chapters: null, painted: ['Dragon kite'] });
    const broken = await readCollection({ log: async () => ({ ok: true, value: [keep(1, 'kite', 'red kite'), page(2, ['kite'])] }), painted: async () => Promise.reject(new Error('no db')) });
    expect(broken).toEqual({ chapters: ['red kite'], painted: null });
  });
});
