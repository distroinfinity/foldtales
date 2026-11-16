import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
// @ts-expect-error: plain .mjs tools, no types
import { runPlan } from '../art/tools/runner.mjs';
// @ts-expect-error: plain .mjs tools, no types
import { spentIn } from '../art/tools/ledger.mjs';

const job = (id: string) => ({ id, model: 'seedream5_pro', ratio: '1024:1024', prompt: 'p' });
const lane = (cap: number, runs: string[]) => ({ id: 'T', capCredits: cap, runs });
function runs(names: string[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-runs-'));
  for (const n of names) fs.mkdirSync(path.join(dir, n));
  return (n: string) => path.join(dir, n);
}
const quiet = () => undefined;

describe('the art runner can neither pay twice nor pass a cap', () => {
  test('killed while a paid task is generating, a rerun picks the task up instead of paying again', async () => {
    const at = runs(['017-a']);
    const plan = { id: '017-a', capCredits: 5, jobs: [job('one')], lane: lane(150, ['017-a']) };
    const killed = new Error('killed');
    const first = { submit: async () => 'task-1', poll: async () => { throw killed; }, download: async () => Buffer.from('x'), pollMs: 1 };
    // The poll error is retried forever, as a network dropout is: the kill is modelled by never returning.
    const run = runPlan({ runDir: at('017-a'), plan, api: { ...first, poll: () => new Promise(() => undefined) }, log: quiet });
    await new Promise((r) => setTimeout(r, 50));
    void run;
    expect(spentIn(at('017-a'))).toBe(5);
    let submitted = 0;
    const second = { submit: async () => (submitted++, 'task-2'), poll: async (id: string) => ({ status: 'SUCCEEDED', url: `u-${id}` }), download: async () => Buffer.from('png'), pollMs: 1 };
    await runPlan({ runDir: at('017-a'), plan, api: second, log: quiet });
    expect(submitted).toBe(0);
    expect(fs.existsSync(path.join(at('017-a'), 'one.png'))).toBe(true);
    expect(spentIn(at('017-a'))).toBe(5);
  });

  test('two runs in one lane at the same moment share its last credits: only one job is paid for', async () => {
    const at = runs(['017-a', '018-b']);
    let submitted = 0;
    const api = { submit: async () => { submitted++; await new Promise((r) => setTimeout(r, 20)); return `t${submitted}`; }, poll: async () => ({ status: 'SUCCEEDED', url: 'u' }), download: async () => Buffer.from('png'), pollMs: 1 };
    const l = lane(5, ['017-a', '018-b']);
    await Promise.all([
      runPlan({ runDir: at('017-a'), plan: { id: '017-a', capCredits: 20, jobs: [job('a')], lane: l }, api, log: quiet }),
      runPlan({ runDir: at('018-b'), plan: { id: '018-b', capCredits: 20, jobs: [job('b')], lane: l }, api, log: quiet }),
    ]);
    expect(submitted).toBe(1);
    expect(spentIn(at('017-a')) + spentIn(at('018-b'))).toBe(5);
  });

  test('a refusal before any charge gives the reservation back; a failure after acceptance stays counted', async () => {
    const at = runs(['017-a']);
    const plan = { id: '017-a', capCredits: 20, jobs: [job('refused'), job('failed')] };
    const api = {
      submit: async (j: { id: string }) => { if (j.id === 'refused') throw Object.assign(new Error('no'), { charged: false }); return 'tf'; },
      poll: async () => ({ status: 'FAILED', failure: 'bad' }),
      download: async () => Buffer.from(''),
      pollMs: 1,
    };
    await runPlan({ runDir: at('017-a'), plan, api, log: quiet });
    expect(spentIn(at('017-a'))).toBe(5);
  });
});
