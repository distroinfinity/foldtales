import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { LISTENING_BUSY, NO_STORY } from '@tabletop/contracts';
import { describe, expect, test } from 'vitest';
import { billedSecondsOf, createTranscriber } from '../src/storyteller/listen.ts';
import { storytellerHandlers } from '../src/storyteller/routes.ts';
import { openStories, readStoryLimits } from '../src/storyteller/stories.ts';
import { createVoices, estimateTtsCost, mp3DurationMs, readLiveVoices, type LiveVoices } from '../src/storyteller/voices.ts';
import type { Painter } from '../src/storyteller/paint.ts';
import type Anthropic from '@anthropic-ai/sdk';
import { guardTestCaller } from './support.ts';

/** An MPEG-1 Layer III stream at 128 kbps, 44.1 kHz: each frame is 417 bytes and 1152 samples. */
function mp3(frames: number): Uint8Array {
  const frame = new Uint8Array(417);
  frame.set([0xff, 0xfb, 0x90, 0x00]);
  const out = new Uint8Array(417 * frames);
  for (let i = 0; i < frames; i++) out.set(frame, i * 417);
  return out;
}

const CONFIG: LiveVoices = {
  model: 'gpt-4o-mini-tts',
  voices: {
    narrator: { voice: 'marin', instructions: 'A warm storyteller.', speed: 0.95 },
    bramble: { voice: 'verse', instructions: 'Young and bright.', speed: 1 },
  },
};

function fakeFetch(answer: () => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const send = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return answer();
  }) as typeof fetch;
  return { send, calls };
}

describe('voices (OpenAI)', () => {
  test('the repo config names the model, and a voice and a direction for every speaker', () => {
    const live = readLiveVoices(new URL('../../art/voice/live.json', import.meta.url).pathname);
    expect(live?.model).toBe('gpt-4o-mini-tts');
    for (const who of ['narrator', 'pip', 'wick', 'moth']) expect(live?.voices[who]?.instructions.length).toBeGreaterThan(40);
    expect(new Set(Object.values(live!.voices).map((v) => v.voice)).size).toBe(Object.keys(live!.voices).length);
  });

  test("asks for the speaker's own voice and direction, and returns the audio inline, timed from its frames", async () => {
    const { send, calls } = fakeFetch(() => new Response(mp3(38)));
    const voices = createVoices('test-key', CONFIG, { fetch: send, log: () => {} });
    const asset = await voices.speak('bramble', 'Hello there, giant.');
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/audio/speech');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ model: 'gpt-4o-mini-tts', voice: 'verse', input: 'Hello there, giant.', instructions: 'Young and bright.', response_format: 'mp3', speed: 1 });
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer test-key');
    expect(asset!.url!.startsWith('data:audio/mpeg;base64,')).toBe(true);
    expect(asset!.durationMs).toBe(993);
    expect(voices.characters).toBe(19);
  });

  test('an unknown speaker gets the narrator; a failure or no key is captions only', async () => {
    const ok = fakeFetch(() => new Response(mp3(10)));
    await createVoices('k', CONFIG, { fetch: ok.send, log: () => {} }).speak('quill', 'Hm.');
    expect(JSON.parse(String(ok.calls[0]!.init.body)).voice).toBe('marin');
    const logs: string[] = [];
    const down = fakeFetch(() => new Response('quota', { status: 429 }));
    expect(await createVoices('k', CONFIG, { fetch: down.send, log: (m) => logs.push(m) }).speak('bramble', 'Hi.')).toBeNull();
    expect(logs[0]).toMatch(/openai answered 429/);
    expect(await createVoices(undefined, CONFIG).speak('bramble', 'Hi.')).toBeNull();
  });

  test('frames are read at any bitrate; not an mp3 is null; the cost estimate is small and grows with length', () => {
    expect(mp3DurationMs(mp3(1))).toBe(26);
    expect(mp3DurationMs(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
    expect(estimateTtsCost(1000, 60_000)).toBeCloseTo(0.01515, 4);
  });
});

describe('listening (Groq)', () => {
  const clip = { mime: 'audio/webm' as const, base64: Buffer.from('opus-bytes').toString('base64') };

  test('sends the clip as a file with the model, English, and asks for its length', async () => {
    const { send, calls } = fakeFetch(() => Response.json({ text: ' A teapot that lost its whistle. ', duration: 2.4 }));
    const heard = await createTranscriber('gsk-test', { fetch: send, log: () => {} }).transcribe(clip);
    expect(heard).toEqual({ text: 'A teapot that lost its whistle.', seconds: 2.4 });
    expect(calls[0]!.url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    const form = calls[0]!.init.body as FormData;
    expect(form.get('model')).toBe('whisper-large-v3-turbo');
    expect(form.get('language')).toBe('en');
    expect((form.get('file') as File).name).toBe('hold.webm');
    expect((form.get('file') as File).type).toBe('audio/webm');
  });

  test('the free tier saying slow down is LISTENING_BUSY, retryable; other failures are upstream', async () => {
    const busy = fakeFetch(() => new Response('rate limited', { status: 429 }));
    await expect(createTranscriber('k', { fetch: busy.send, log: () => {} }).transcribe(clip)).rejects.toMatchObject({ code: 'quota_exceeded', message: LISTENING_BUSY, retryable: true });
    const down = fakeFetch(() => new Response('no', { status: 500 }));
    await expect(createTranscriber('k', { fetch: down.send, log: () => {} }).transcribe(clip)).rejects.toMatchObject({ code: 'upstream_failed' });
    await expect(createTranscriber(undefined).transcribe(clip)).rejects.toMatchObject({ code: 'upstream_failed' });
  });

  test('a hold is billed at least 10 seconds, and more for a long one', () => {
    expect(billedSecondsOf(2.4)).toBe(10);
    expect(billedSecondsOf(28.2)).toBe(29);
  });
});

describe('the transcribe route', () => {
  function handlers(answer: () => Promise<{ text: string; seconds: number | null }>) {
    const stories = openStories(new DatabaseSync(':memory:'), { ...readStoryLimits({}), holdsPerReaderDay: 2 });
    const painter = { start: () => null, result: () => ({ status: 'failed', reason: 'off' }) } as unknown as Painter;
    const h = storytellerHandlers({
      stories,
      anthropic: {} as Anthropic,
      voices: { characters: 0, speak: async () => null, sound: async () => null },
      painter,
      checkLine: async () => true,
      transcriber: { transcribe: answer },
    });
    return { h, stories };
  }
  const audio = { mime: 'audio/webm' as const, base64: readFileSync(new URL('./fixtures/hold.webm', import.meta.url)).toString('base64') };

  test("hears a hold for the reader's own story in progress, counts it, and measures its seconds", async () => {
    const { h, stories } = handlers(async () => ({ text: 'a kite', seconds: 3.2 }));
    await guardTestCaller('ann', async () => {
      const { storyId } = await h.startStory({ requestId: 'r1' });
      expect(await h.transcribe({ storyId, audio })).toEqual({ text: 'a kite' });
      expect(stories.storySpend(storyId)).toEqual({ stt: 10 });
      await h.transcribe({ storyId, audio });
      await expect(h.transcribe({ storyId, audio })).rejects.toMatchObject({ message: 'listening has reached its daily limit' });
    });
  });

  test("nothing is heard for a story that isn't the reader's", async () => {
    let called = 0;
    const { h } = handlers(async () => ((called += 1), { text: 'x', seconds: 1 }));
    const storyId = await guardTestCaller('ann', async () => (await h.startStory({ requestId: 'r1' })).storyId);
    await expect(guardTestCaller('bob', () => h.transcribe({ storyId, audio }))).rejects.toMatchObject({ message: NO_STORY });
    expect(called).toBe(0);
  });
});
