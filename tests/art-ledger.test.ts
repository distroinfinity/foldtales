import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
// @ts-expect-error: a plain .mjs tool, no types
import { laneSpent, mayStart, priceOf, record, spentIn } from '../art/tools/ledger.mjs';

const runs = () => fs.mkdtempSync(path.join(os.tmpdir(), 'runs-'));

describe('the art runner prices and caps a run from its own ledger', () => {
  test('list prices', () => {
    expect(priceOf({ model: 'seedream5_pro', ratio: '1024:1024' })).toBe(5);
    expect(priceOf({ model: 'seedream5_pro', ratio: '1376:768' })).toBe(5);
    expect(priceOf({ model: 'seedream5_pro', ratio: '2720:1530' })).toBe(9);
    expect(priceOf({ model: 'seedream5_flash', ratio: '1024:1024' })).toBe(2);
    expect(priceOf({ model: 'other', ratio: '1:1', credits: 3 })).toBe(3);
    expect(() => priceOf({ model: 'other', ratio: '1:1' })).toThrow(/no known price/);
  });

  test('a job that would pass the run cap or the lane cap does not start', () => {
    expect(mayStart({ price: 5, runSpent: 15, runCap: 20 }).ok).toBe(true);
    expect(mayStart({ price: 9, runSpent: 15, runCap: 20 }).ok).toBe(false);
    expect(mayStart({ price: 5, runSpent: 0, runCap: 20, laneSpent: 148, laneCap: 150 })).toMatchObject({ ok: false });
  });

  test('spending counts across invocations and across the lane, at list price, failures included', () => {
    const dir = runs();
    const a = path.join(dir, '017-a');
    const b = path.join(dir, '018-b');
    fs.mkdirSync(a);
    fs.mkdirSync(b);
    record(a, { job: 'one', cost: 5, balanceDrop: 260 });
    record(a, { job: 'two', cost: 5, failed: 'FAILED' });
    fs.writeFileSync(path.join(b, 'manifest.jsonl'), `${JSON.stringify({ job: 'old', credits: 9 })}\n`);
    expect(spentIn(a)).toBe(10);
    expect(laneSpent(a, { lane: { id: 'B', capCredits: 150, runs: ['017-a', '018-b'] } })).toBe(19);
    expect(laneSpent(a, {})).toBeNull();
  });
});
