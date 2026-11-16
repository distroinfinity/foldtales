import type Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { NO_STORY, type StoryTurnRequest, type TurnEvent } from '@tabletop/contracts';
import { fixtureLibrary } from '@tabletop/contracts/mocks';
import { describe, expect, test } from 'vitest';
import { tokenBound, type Claude } from '../src/director/claude.ts';
import { createPainter } from '../src/storyteller/paint.ts';
import { storytellerHandlers } from '../src/storyteller/routes.ts';
import { openStories, readStoryLimits, type Stories } from '../src/storyteller/stories.ts';
import { RULES, TURN_MAX_TOKENS, UNTITLED, contextOf, storyTurn } from '../src/storyteller/turn.ts';
import type { Voices } from '../src/storyteller/voices.ts';
import type { Painter } from '../src/storyteller/paint.ts';
import { guardTestCaller } from './support.ts';

/** Regression tests for Codex's review of PR #30 (findings 1–5 and 11; 6 and 12 are in stories.test.ts, 13 in welcome.test.ts). */

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url)).toString('base64');

function fakeStream(text: string, calls: { n: number } = { n: 0 }) {
  return {
    calls,
    anthropic: {
      messages: {
        stream() {
          calls.n += 1;
          return {
            async *[Symbol.asyncIterator]() {
              for (const line of text.split(/(?<=\n)/)) yield { type: 'content_block_delta', delta: { type: 'text_delta', text: line } };
            },
            finalMessage: async () => ({ stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }),
            abort() {},
          };
        },
      },
    } as unknown as Anthropic,
  };
}

const silentVoices = (): Voices & { said: string[] } => {
  const said: string[] = [];
  return { said, characters: 0, sound: async () => null, speak: async (_s, text) => (said.push(text), { url: 'data:x', durationMs: 500 }) };
};

function handlers(opts: { aiOn?: boolean; checkLine?: (t: string) => Promise<boolean>; transcribe?: () => Promise<{ text: string; seconds: number | null }>; stories?: Stories; stream?: string } = {}) {
  const stories = opts.stories ?? openStories(new DatabaseSync(':memory:'), readStoryLimits({}));
  const checks: string[] = [];
  const heard = { n: 0 };
  const fake = fakeStream(opts.stream ?? 'LISTEN bramble\n');
  const h = storytellerHandlers({
    stories,
    anthropic: fake.anthropic,
    voices: silentVoices(),
    painter: { start: () => null, result: () => ({ status: 'failed', reason: 'off' }) } as unknown as Painter,
    checkLine: async (t) => (checks.push(t), opts.checkLine ? opts.checkLine(t) : true),
    transcriber: { transcribe: async () => ((heard.n += 1), opts.transcribe ? opts.transcribe() : { text: 'a kite', seconds: 1.6 }) },
    aiOn: () => opts.aiOn ?? true,
  });
  return { h, stories, checks, heard, model: fake.calls };
}

const page = { title: 'The paper boat', summary: 'It sailed home.', things: [] };

describe('1: ending a story', () => {
  test('with the Storyteller off, a story still ends, with trusted copy and no paid check', async () => {
    const { h, stories, checks } = handlers({ aiOn: false });
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      stories.setTitle(storyId, 'The checked title', null);
      const { record } = await h.endStory({ storyId, reason: 'cap', page: { title: 'Anything at all', summary: 'Unchecked words.', things: [] } });
      expect(record).toMatchObject({ title: 'The checked title', summary: null });
      expect(checks).toEqual([]);
    });
  });

  test("an unknown story, or another reader's, is refused before any check", async () => {
    const { h, checks } = handlers();
    const storyId = await guardTestCaller('ann', async () => (await h.startStory({ requestId: 'r1' })).storyId);
    await expect(guardTestCaller('bob', () => h.endStory({ storyId, reason: 'time', page }))).rejects.toMatchObject({ message: NO_STORY });
    await expect(guardTestCaller('ann', () => h.endStory({ storyId: 'st-none', reason: 'time', page }))).rejects.toMatchObject({ message: NO_STORY });
    expect(checks).toEqual([]);
  });

  test('retries sent together share one completion: one pair of checks, one record', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { h, checks } = handlers({ checkLine: async () => (await gate, true) });
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      const a = h.endStory({ storyId, reason: 'time', page });
      const b = h.endStory({ storyId, reason: 'time', page });
      release();
      const [ra, rb] = await Promise.all([a, b]);
      expect(ra.record).toEqual(rb.record);
      expect(checks).toHaveLength(2);
      // Afterwards, the saved record, with nothing checked again.
      await h.endStory({ storyId, reason: 'time', page });
      expect(checks).toHaveLength(2);
    });
  });
});

describe('2: a turn is bounded before it is paid for', () => {
  const turn = (storyId: string, history: StoryTurnRequest['history'], turnId = 't1'): StoryTurnRequest => ({
    storyId,
    turnId,
    phase: 'middle',
    activeSeconds: 60,
    library: fixtureLibrary(),
    stage: { setId: 'glade', cast: [], objects: [], light: 'dusk', lampLit: false },
    room: [],
    input: { kind: 'quiet', seconds: 20 },
    history,
  });
  const all = async (s: AsyncIterable<TurnEvent>) => {
    const out: TurnEvent[] = [];
    for await (const e of s) out.push(e);
    return out;
  };

  test('an over-long prompt is refused: no model call, nothing reserved, and the turn id is still free', async () => {
    const { h, model, stories } = handlers();
    const reserved: number[] = [];
    const reserve = stories.reserveSpend.bind(stories);
    stories.reserveSpend = (kind, units) => (reserved.push(units), reserve(kind, units));
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      const huge = Array.from({ length: 40 }, () => ({ who: 'reader', text: 'x'.repeat(5_000) }));
      expect(await all(h.storyTurn(turn(storyId, huge)))).toEqual([{ kind: 'error', code: 'bad_request', message: 'the turn is too long' }]);
      expect(model.n).toBe(0);
      expect(reserved).toEqual([]);
      expect((await all(h.storyTurn(turn(storyId, [])))).at(-1)?.kind).toBe('listen');
    });
  });

  test('a turn reserves an upper bound from its real prompt and its whole allowed output', async () => {
    const { h, stories } = handlers();
    const reserved: number[] = [];
    const reserve = stories.reserveSpend.bind(stories);
    stories.reserveSpend = (kind, units) => (reserved.push(units), reserve(kind, units));
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      const request = turn(storyId, [{ who: 'reader', text: 'a kite' }]);
      await all(h.storyTurn(request));
      const expected = tokenBound(RULES, contextOf(request, { title: null, plan: null, recent: [] }), TURN_MAX_TOKENS, false);
      expect(reserved[0]).toBe(expected);
      expect(expected).toBeGreaterThan(TURN_MAX_TOKENS);
    });
  });

  test("every Claude call's bound covers its prompt, a picture, and the whole output", () => {
    expect(tokenBound('s'.repeat(300), 'u'.repeat(300), 50, false)).toBe(250);
    expect(tokenBound('s'.repeat(300), 'u'.repeat(300), 50, true)).toBe(1850);
  });
});

describe('3: a hold is measured from the clip itself', () => {
  test('only Opus in WebM or Ogg is heard; anything else is refused before the provider', async () => {
    const { h, heard } = handlers();
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      await expect(h.transcribe({ storyId, audio: { mime: 'audio/mp4', base64: fixture('hold.webm') } })).rejects.toMatchObject({ code: 'bad_request' });
      await expect(h.transcribe({ storyId, audio: { mime: 'audio/webm', base64: 'AAAAAAAA' } })).rejects.toMatchObject({ code: 'bad_request' });
      expect(heard.n).toBe(0);
    });
  });

  test('a clip longer than a hold is refused, however small it is', async () => {
    const { h, heard } = handlers();
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      await expect(h.transcribe({ storyId, audio: { mime: 'audio/webm', base64: fixture('hold-31s.webm') } })).rejects.toMatchObject({ code: 'bad_request', message: 'the clip is longer than a hold' });
      expect(heard.n).toBe(0);
    });
  });

  test('the verified length is reserved, and a provider claiming more never raises the ledger past a hold', async () => {
    const { h, stories } = handlers({ transcribe: async () => ({ text: 'a kite', seconds: 300 }) });
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      for (const [name, mime] of [['hold.webm', 'audio/webm'], ['hold-live.webm', 'audio/webm'], ['hold.ogg', 'audio/ogg']] as const) {
        await h.transcribe({ storyId, audio: { mime, base64: fixture(name) } });
      }
      expect(stories.storySpend(storyId).stt).toBe(30);
    });
  });
});

describe('4 and 11: painting', () => {
  const named = { name: 'chipped teapot', description: 'A small blue teapot with a chip.', tags: ['lightweight'], size: 'medium', paint: 'a small blue teapot', fit: true };

  function painter(answer: () => Promise<Response>, checkLine: (t: string) => Promise<boolean> = async () => true) {
    const stories = openStories(new DatabaseSync(':memory:'), { ...readStoryLimits({}), paintCreditCap: 2 });
    const claude: Claude = { ask: async () => named as never };
    let runway = 0;
    const p = createPainter({
      runwayKey: 'key',
      claude,
      styleRefPath: new URL('../../art/runs/013-live-props/style-ref.png', import.meta.url).pathname,
      stories,
      checkPicture: async () => true,
      checkLine,
      enabled: () => true,
      fetch: (async () => ((runway += 1), answer())) as typeof fetch,
      pollMs: 1,
    });
    const storyId = stories.start('ann', 'r1').storyId;
    return { p, stories, storyId, runway: () => runway };
  }
  const settle = async (p: ReturnType<typeof createPainter>, jobId: string) => {
    for (let i = 0; i < 50 && p.result(jobId).status === 'pending'; i++) await new Promise((r) => setTimeout(r, 5));
    return p.result(jobId);
  };
  const poolLeft = (s: Stories, storyId: string): boolean => {
    try {
      s.claimPaint('ann', storyId, 'another');
      return true;
    } catch {
      return false;
    }
  };

  test.each([
    ['the answer was lost', () => Promise.reject(new Error('reset')), false],
    ['a server error', async () => new Response('oops', { status: 502 }), false],
    ['an unreadable reply', async () => new Response('not json', { status: 200 }), false],
    ['a definite refusal', async () => new Response('{"error":"bad"}', { status: 400 }), true],
  ] as const)('%s: credits come back only when Runway certainly took nothing', async (_name, answer, refunded) => {
    const { p, stories, storyId } = painter(answer);
    const jobId = p.start('ann', { storyId, objectId: 'teapot', description: 'a teapot', image: null })!;
    expect((await settle(p, jobId)).status).toBe('failed');
    expect(poolLeft(stories, storyId)).toBe(refunded);
  });

  test("a name or description that fails its check is never painted, returned or kept", async () => {
    const { p, stories, storyId, runway } = painter(async () => new Response('{}'), async (t) => !t.includes('chip'));
    const jobId = p.start('ann', { storyId, objectId: 'teapot', description: 'a teapot', image: null })!;
    const result = await settle(p, jobId);
    expect(result).toMatchObject({ status: 'failed' });
    expect(runway()).toBe(0);
    expect(poolLeft(stories, storyId)).toBe(true);
  });
});

describe('5: a rejected line never reaches the voices', () => {
  test('zero voice calls for a line that fails its check, or whose check fails', async () => {
    for (const check of [async () => false, async () => Promise.reject(new Error('down'))]) {
      const voices = silentVoices();
      const { anthropic } = fakeStream('SAY bramble warm | An unfit line.\nLISTEN bramble\n');
      const events: TurnEvent[] = [];
      const request: StoryTurnRequest = {
        storyId: 'st-1',
        turnId: 't1',
        phase: 'middle',
        activeSeconds: 60,
        library: fixtureLibrary(),
        stage: { setId: 'glade', cast: [{ id: 'bramble', mark: 'stump', holding: null }], objects: [], light: 'dusk', lampLit: false },
        room: [],
        input: { kind: 'quiet', seconds: 20 },
        history: [],
      };
      for await (const e of storyTurn(request, { anthropic, voices, checkLine: check })) events.push(e);
      expect(voices.said).toEqual([]);
      expect(events.at(-1)?.kind).toBe('redirect');
    }
  });
});

test('the untitled name is the fallback everywhere', () => {
  expect(UNTITLED).toBe("Tonight's story");
});
