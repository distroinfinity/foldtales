import { afterEach, describe, expect, test, vi } from 'vitest';
import { MAX_HOLD_MS, createEars, type EarState, type Heard } from '../client/src/storyteller/ears.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A fake microphone and recorder: what it records is fixed, and every track's stop is counted. */
function fakeMedia() {
  const stopped = { tracks: 0 };
  let current: { ondataavailable: ((e: { data: Blob }) => void) | null; onstop: (() => void) | null; onerror: (() => void) | null; state: string } | null = null;
  const options: MediaRecorderOptions[] = [];
  const media = {
    getUserMedia: async () => ({ getTracks: () => [{ stop: () => void (stopped.tracks += 1) }] }) as unknown as MediaStream,
    recorder: (_stream: MediaStream, o: MediaRecorderOptions) => {
      options.push(o);
      const r = {
        ondataavailable: null,
        onstop: null,
        onerror: null,
        state: 'inactive',
        start() {
          r.state = 'recording';
        },
        stop() {
          r.state = 'inactive';
          r.ondataavailable?.({ data: new Blob(['opus-bytes'], { type: 'audio/webm' }) });
          r.onstop?.();
        },
      } as unknown as typeof current & MediaRecorder;
      current = r as never;
      return r as unknown as MediaRecorder;
    },
    supports: (mime: string) => mime === 'audio/webm;codecs=opus',
  };
  return { media, stopped, options, recorder: () => current };
}

function setup(answer: () => Promise<Heard>) {
  const m = fakeMedia();
  const sent: Array<{ mime: string; base64: string }> = [];
  const heard: string[] = [];
  const missed: string[] = [];
  const states: EarState[] = [];
  const ears = createEars({
    media: m.media,
    transcribe: async (audio) => {
      sent.push(audio);
      return answer();
    },
    heard: (t) => heard.push(t),
    missed: (why) => missed.push(why),
    onState: (s) => states.push(s),
  });
  return { ears, sent, heard, missed, states, ...m };
}

afterEach(() => void vi.useRealTimers());

describe('hold to talk', () => {
  test('records Opus while held, and sends the clip on release; the words reach the story', async () => {
    const h = setup(async () => ({ text: 'a teapot' }));
    await h.ears.hold();
    expect(h.states).toEqual(['opening', 'listening']);
    expect(h.options[0]).toEqual({ mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32_000 });
    h.ears.release();
    await tick();
    await tick();
    expect(h.sent).toEqual([{ mime: 'audio/webm', base64: btoa('opus-bytes') }]);
    expect(h.heard).toEqual(['a teapot']);
    expect(h.states.at(-1)).toBe('off');
    expect(h.stopped.tracks).toBe(1);
  });

  test('a busy listener is said plainly; a failure too', async () => {
    const busy = setup(async () => 'busy');
    await busy.ears.hold();
    busy.ears.release();
    await tick();
    await tick();
    expect(busy.missed).toEqual(['busy']);
    const failed = setup(async () => null);
    await failed.ears.hold();
    failed.ears.release();
    await tick();
    await tick();
    expect(failed.missed).toEqual(['failed']);
    expect(failed.heard).toEqual([]);
  });

  test('stop sends nothing and closes the microphone at once', async () => {
    const h = setup(async () => ({ text: 'never' }));
    await h.ears.hold();
    h.ears.stop();
    await tick();
    expect(h.sent).toEqual([]);
    expect(h.stopped.tracks).toBe(1);
    expect(h.ears.state).toBe('off');
  });

  test('a hold that goes on too long is cut off and sent', async () => {
    vi.useFakeTimers();
    const h = setup(async () => ({ text: 'a long story' }));
    await h.ears.hold();
    vi.advanceTimersByTime(MAX_HOLD_MS + 10);
    vi.useRealTimers();
    await tick();
    await tick();
    expect(h.sent).toHaveLength(1);
    expect(h.heard).toEqual(['a long story']);
  });

  test("a browser that can't record says so, and doesn't open the microphone", async () => {
    const h = setup(async () => ({ text: 'x' }));
    const ears = createEars({ media: { ...h.media, supports: () => false }, transcribe: async () => null, heard: () => {}, missed: (w) => h.missed.push(w) });
    await ears.hold();
    expect(h.missed).toEqual(['failed']);
    expect(h.stopped.tracks).toBe(0);
  });
});
