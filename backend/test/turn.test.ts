import type Anthropic from '@anthropic-ai/sdk';
import { DatabaseSync } from 'node:sqlite';
import { fixtureLibrary } from '@tabletop/contracts/mocks';
import type { StoryTurnRequest, TurnEvent, TurnInput } from '@tabletop/contracts';
import { describe, expect, test } from 'vitest';
import { createLineCheck, createPictureCheck } from '../src/storyteller/moderate.ts';
import { storytellerHandlers } from '../src/storyteller/routes.ts';
import { openStories, readStoryLimits } from '../src/storyteller/stories.ts';
import { REDIRECT_LINE, UNTITLED, storyTurn, type TurnDeps } from '../src/storyteller/turn.ts';
import type { Voices } from '../src/storyteller/voices.ts';
import type { Claude } from '../src/director/claude.ts';
import type { Painter } from '../src/storyteller/paint.ts';
import { guardTestCaller } from './support.ts';

/** A stand-in for Anthropic's stream: the given text, in chunks, then a final message. */
function fakeAnthropic(text: string, { stop = 'end_turn', calls = { n: 0, prompts: [] as string[] }, gateMs = 0 } = {}) {
  const anthropic = {
    messages: {
      stream(params: { messages: Array<{ content: string }> }) {
        calls.n += 1;
        calls.prompts.push(params.messages[0]!.content);
        const chunks = text.match(/[^\n]*\n?/g)!.filter(Boolean);
        return {
          async *[Symbol.asyncIterator]() {
            if (gateMs) await new Promise((r) => setTimeout(r, gateMs));
            for (const c of chunks) yield { type: 'content_block_delta', delta: { type: 'text_delta', text: c } };
          },
          async finalMessage() {
            return { stop_reason: stop, usage: { input_tokens: 3000, output_tokens: 200, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 } };
          },
          abort() {},
        };
      },
    },
  };
  return { anthropic: anthropic as unknown as Anthropic, calls };
}

const voices: Voices = { characters: 0, speak: async () => ({ url: 'data:audio/mpeg;base64,AA', durationMs: 900 }), sound: async () => null };

function request(input: TurnInput, over: Partial<StoryTurnRequest> = {}): StoryTurnRequest {
  return {
    storyId: 'st-1',
    turnId: `t-${Math.random().toString(36).slice(2, 10)}`,
    phase: 'middle',
    activeSeconds: 120,
    library: fixtureLibrary(),
    stage: { setId: 'glade', cast: [{ id: 'bramble', mark: 'stump', holding: null }], objects: [], light: 'dusk', lampLit: false },
    room: [],
    input,
    history: [],
    ...over,
  };
}

async function all(events: AsyncIterable<TurnEvent>): Promise<TurnEvent[]> {
  const out: TurnEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

const spoken = (events: TurnEvent[]) =>
  events.flatMap((e) => (e.kind === 'beat' ? e.ready.beat.actions.flatMap((a) => (a.do === 'speak' || a.do === 'narrate' ? [a.text] : [])) : []));

const deps = (anthropic: Anthropic, over: Partial<TurnDeps> = {}): TurnDeps => ({ anthropic, voices, checkLine: async () => true, ...over });

describe('the turn', () => {
  test('the welcome carries the last stories, by title and ending only', async () => {
    const { anthropic, calls } = fakeAnthropic('SAY bramble warm | Oh! It is you.\nLISTEN bramble\n');
    await all(storyTurn(request({ kind: 'open' }, { phase: 'welcome' }), deps(anthropic, { story: { title: null, plan: null, recent: [{ title: 'The odd sock', summary: 'It found its pair.' }] } })));
    expect(calls.prompts[0]).toContain('The odd sock: It found its pair.');
    expect(calls.prompts[0]).toContain('The story begins');
  });

  test('a premise names the story and saves its plan; the title is checked first', async () => {
    const { anthropic } = fakeAnthropic('TITLE | The Whistle That Lost Its Song\nPLAN | The whistle is mute; ask the reader where to look; it sings at the end.\nSAY bramble wonder | A whistle with no song!\nLISTEN bramble\n');
    const saved: Array<[string, string | null]> = [];
    const events = await all(storyTurn(request({ kind: 'heard', text: 'a whistle that lost its song', to: null }, { phase: 'welcome' }), deps(anthropic, { onTitle: (t, p) => saved.push([t, p]) })));
    expect(events.find((e) => e.kind === 'titled')).toEqual({ kind: 'titled', title: 'The Whistle That Lost Its Song' });
    expect(saved.at(-1)).toEqual(['The Whistle That Lost Its Song', 'The whistle is mute; ask the reader where to look; it sings at the end.']);
    expect(events.at(-1)).toEqual({ kind: 'listen', who: 'bramble' });
  });

  test('a title that fails its check is never sent or saved', async () => {
    const { anthropic } = fakeAnthropic('TITLE | Something Unfit\nSAY bramble warm | Off we go.\nLISTEN bramble\n');
    const saved: string[] = [];
    const events = await all(storyTurn(request({ kind: 'heard', text: 'go', to: null }, { phase: 'welcome' }), deps(anthropic, { checkLine: async (t) => !t.includes('Unfit'), onTitle: (t) => saved.push(t) })));
    expect(events.some((e) => e.kind === 'titled')).toBe(false);
    expect(saved).toEqual([]);
  });

  test('a line that fails its check stops the turn there: the lines before it stand, then the redirect', async () => {
    const { anthropic } = fakeAnthropic('SAY bramble warm | First line.\nSAY bramble warm | A bad line.\nSAY bramble warm | Never heard.\nLISTEN bramble\n');
    const events = await all(storyTurn(request({ kind: 'quiet', seconds: 20 }), deps(anthropic, { checkLine: async (t) => !t.includes('bad') })));
    expect(spoken(events)).toEqual(['First line.']);
    expect(events.at(-1)).toMatchObject({ kind: 'redirect', text: REDIRECT_LINE });
  });

  test("Claude's own refusal is told in story", async () => {
    const { anthropic } = fakeAnthropic('', { stop: 'refusal' });
    const events = await all(storyTurn(request({ kind: 'heard', text: 'hello', to: null }), deps(anthropic)));
    expect(events).toEqual([expect.objectContaining({ kind: 'redirect' })]);
  });

  test('the close ends with its checked summary, under the story title; an unfit summary is dropped', async () => {
    const text = 'SAY bramble relief | And so the whistle sang again.\nEND | The whistle found its song in the brook. Bramble kept it safe.\n';
    const story = { title: 'The Whistle', plan: null, recent: [] };
    const ok = await all(storyTurn(request({ kind: 'close', reason: 'time' }, { phase: 'closing' }), deps(fakeAnthropic(text).anthropic, { story })));
    expect(ok.at(-1)).toEqual({ kind: 'ending', title: 'The Whistle', summary: 'The whistle found its song in the brook. Bramble kept it safe.' });
    const unfit = await all(storyTurn(request({ kind: 'close', reason: 'time' }, { phase: 'closing' }), deps(fakeAnthropic(text).anthropic, { checkLine: async (t) => !t.startsWith('The whistle found') })));
    expect(unfit.at(-1)).toEqual({ kind: 'ending', title: UNTITLED, summary: null });
  });

  test('a close never paints, and the real usage is reported', async () => {
    const used: Array<number | null> = [];
    let painted = 0;
    const text = 'PAINT teapot | a chipped teapot\nSAY bramble warm | The end.\nEND | It ended well, and gently, by the brook.\n';
    await all(storyTurn(request({ kind: 'close', reason: 'reader' }, { phase: 'closing' }), deps(fakeAnthropic(text).anthropic, { onUsage: (n) => used.push(n), paint: () => `job-${++painted}` })));
    expect(painted).toBe(0);
    expect(used).toEqual([4200]);
  });

  test('the prompt no longer promises a thunder flash or a darkened room', async () => {
    const { anthropic, calls } = fakeAnthropic('LISTEN bramble\n');
    await all(storyTurn(request({ kind: 'quiet', seconds: 20 }, { stage: { setId: 'glade', cast: [], objects: [], light: 'dusk', lampLit: false, roomFx: { on: [], available: ['rain', 'thunder'] } } }), deps(anthropic)));
    expect(calls.prompts[0]).not.toMatch(/flash lights|it darkens/);
  });
});

describe('the checks fail closed', () => {
  const failing = (how: 'throw' | 'hang'): Claude => ({
    ask: () => (how === 'throw' ? Promise.reject(new Error('down')) : new Promise(() => {})),
  });
  test('a line check that errors is false', async () => {
    expect(await createLineCheck(failing('throw'))('hello')).toBe(false);
  });
  test('a picture check that errors is false', async () => {
    expect(await createPictureCheck(failing('throw'))(Buffer.from('x'), 'a teapot')).toBe(false);
  });
  test('the check passes its own time bound to the call', async () => {
    let bound = 0;
    await createLineCheck({ ask: async (o) => ((bound = o.timeoutMs), { fit: true }) as never })('hello');
    expect(bound).toBe(2500);
  });
});

describe('a turn id runs once, through the handlers', () => {
  function handlers(anthropic: Anthropic) {
    const stories = openStories(new DatabaseSync(':memory:'), readStoryLimits({}));
    const painter = { start: () => null, result: () => ({ status: 'failed', reason: 'off' }) } as unknown as Painter;
    const h = storytellerHandlers({ stories, anthropic, voices, painter, checkLine: async () => true, transcriber: { transcribe: async () => ({ text: '', seconds: null }) } });
    return { h, stories };
  }

  test('a repeat recovers without calling the model again; so does a copy sent at the same time', async () => {
    const fake = fakeAnthropic('SAY bramble warm | Hello there.\nLISTEN bramble\n', { gateMs: 20 });
    const { h } = handlers(fake.anthropic);
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      const req = request({ kind: 'open' }, { storyId, turnId: 'turn-1', phase: 'welcome' });
      const [a, b] = await Promise.all([all(h.storyTurn(req)), all(h.storyTurn(req))]);
      expect([a.at(-1)?.kind, b.at(-1)?.kind].sort()).toEqual(['listen', 'recover']);
      expect(await all(h.storyTurn(req))).toEqual([{ kind: 'recover' }]);
      expect(fake.calls.n).toBe(1);
    });
  });

  test("another reader's story is an error, and calls nothing", async () => {
    const fake = fakeAnthropic('LISTEN bramble\n');
    const { h } = handlers(fake.anthropic);
    const storyId = await guardTestCaller('ann', async () => (await h.startStory({ requestId: 'r1' })).storyId);
    const events = await guardTestCaller('bob', () => all(h.storyTurn(request({ kind: 'open' }, { storyId }))));
    expect(events).toEqual([expect.objectContaining({ kind: 'error', code: 'bad_request' })]);
    expect(fake.calls.n).toBe(0);
  });

  test('a saved page is checked: an unfit title is saved as the untitled name', async () => {
    const fake = fakeAnthropic('LISTEN bramble\n');
    const stories = openStories(new DatabaseSync(':memory:'), readStoryLimits({}));
    const painter = { start: () => null, result: () => ({ status: 'failed', reason: 'off' }) } as unknown as Painter;
    const h = storytellerHandlers({ stories, anthropic: fake.anthropic, voices, painter, checkLine: async (t) => !t.includes('unfit'), transcriber: { transcribe: async () => ({ text: '', seconds: null }) } });
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      const { record } = await h.endStory({ storyId, reason: 'failed', page: { title: 'An unfit title', summary: 'A fine summary of the night.', things: [] } });
      expect(record).toMatchObject({ title: UNTITLED, summary: 'A fine summary of the night.' });
      expect((await h.listStories({})).stories).toHaveLength(1);
    });
  });

  test('a turn past the spend ceiling is refused before the model is called', async () => {
    const fake = fakeAnthropic('LISTEN bramble\n');
    const stories = openStories(new DatabaseSync(':memory:'), { ...readStoryLimits({}), spend: { claude: 20_000, tts: 10_000, stt: 10 } });
    const painter = { start: () => null, result: () => ({ status: 'failed', reason: 'off' }) } as unknown as Painter;
    const h = storytellerHandlers({ stories, anthropic: fake.anthropic, voices, painter, checkLine: async () => true, transcriber: { transcribe: async () => ({ text: '', seconds: null }) } });
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      stories.reserveSpend('claude', 11_000);
      const events = await all(h.storyTurn(request({ kind: 'open' }, { storyId })));
      expect(events).toEqual([expect.objectContaining({ kind: 'error', message: 'the storyteller is resting' })]);
      expect(fake.calls.n).toBe(0);
    });
  });
});
