import type { TelemetryBatch } from '@tabletop/contracts';

type TelemetryEvent = TelemetryBatch['events'][number];
type Unstamped = TelemetryEvent extends infer E ? (E extends TelemetryEvent ? Omit<E, 'at'> : never) : never;

const MAX_QUEUE = 500;
const WINDOW_MS = 10_000;
const HITCH_MS = 100;
/** Longer than this, the frame loop was paused (headset off, page hidden), not slow. */
const PAUSE_MS = 5_000;
const MAX_FRAMES = 2048;

export interface Telemetry {
  record(event: Unstamped): void;
  /** `phase` names the moment (searching, drop, opening…) a hitch happened in. */
  frame(deltaMs: number, render: { calls: number; triangles: number }, phase?: string): void;
  flush(): Promise<void>;
  queued(): number;
}

/** Best effort throughout: nothing here throws into the frame loop or holds up the stage. */
export function createTelemetry(
  send: (batch: TelemetryBatch) => Promise<unknown>,
  clock: { nowIso(): string },
  ids: { buildId: string; sessionId: string },
): Telemetry {
  const queue: TelemetryEvent[] = [];
  const frames = new Float32Array(MAX_FRAMES);
  let frameCount = 0;
  let windowMs = 0;
  let sending = false;

  function record(event: Unstamped): void {
    queue.push({ ...event, at: clock.nowIso() } as TelemetryEvent);
    if (queue.length > MAX_QUEUE) queue.shift();
  }

  function summarise(render: { calls: number; triangles: number }): void {
    const sorted = frames.subarray(0, frameCount).sort();
    const at = (share: number): number => sorted[Math.min(frameCount - 1, Math.floor(frameCount * share))]!;
    record({
      kind: 'frame_summary',
      windowSeconds: windowMs / 1000,
      medianFps: Math.round(1000 / at(0.5)),
      lowFps: Math.round(1000 / at(0.99)),
      drawCalls: render.calls,
      triangles: render.triangles,
    });
    frameCount = 0;
    windowMs = 0;
  }

  return {
    record,
    frame(deltaMs, render, phase = 'frame') {
      if (deltaMs <= 0 || deltaMs > PAUSE_MS) return;
      if (deltaMs > HITCH_MS) record({ kind: 'hitch', ms: deltaMs, phase });
      if (frameCount < MAX_FRAMES) frames[frameCount++] = deltaMs;
      windowMs += deltaMs;
      if (windowMs >= WINDOW_MS) summarise(render);
    },
    async flush() {
      if (sending || queue.length === 0) return;
      sending = true;
      const events = queue.splice(0, MAX_QUEUE);
      try {
        await send({ v: 1, ...ids, events });
      } catch {
        // Dropped on purpose. Telemetry must never become the thing that fails.
      } finally {
        sending = false;
      }
    },
    queued: () => queue.length,
  };
}
