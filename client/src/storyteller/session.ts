import { linesOf, type BackendApi, type Beat, type LightMood, type ObjectDef, type RoomPlace, type ShowObject, type StageLibrary, type StageNow, type StoryTurnRequest, type TurnEvent, type TurnInput } from '@tabletop/contracts';
import type { SoundEngine } from '../sound/engine.ts';
import type { LiveScheduler } from './live.ts';

/**
 * One evening with the AI Storyteller, as a turn state machine: listening, then thinking (the turn
 * is being written), then performing (its beats play), then listening again. Anything you do while
 * they think or perform starts a new generation: everything from the old one is dropped, so a late
 * line can never play over your interruption.
 */

export type StoryState = 'opening' | 'listening' | 'thinking' | 'performing';

/** Quiet this long while they listen, and the story carries itself on a little. */
const QUIET_MS = 28_000;
/** At most this many quiet turns in a row, then they simply wait. */
const QUIET_TURNS = 2;

export interface SessionDeps {
  /** Calls the backend, or null when it can't be reached. */
  withBackend<T>(call: (api: BackendApi) => Promise<T>): Promise<T | null>;
  stream(request: StoryTurnRequest): AsyncIterable<TurnEvent> | null;
  live: LiveScheduler;
  sound: SoundEngine;
  library: StageLibrary;
  /** The objects the story may name now, with their defs. */
  objects(): ShowObject[];
  /** Who is on the spread showing now, and at which mark, holding what. */
  cast(): StageNow['cast'];
  room(): RoomPlace[];
  /** Room effects showing now, and the ones this room and build can show. */
  roomFx?(): NonNullable<StageNow['roomFx']>;
  /** The show clock. */
  nowMs(): number;
  log?(message: string): void;
  /** A painting the story asked for. */
  onPaint?(job: { jobId: string; objectId: string; description: string }): void;
  /** A turn failed: a guest's "sign in" (401), no connection, or the story slipped. */
  onError?(code: string, message: string): void;
  /** Someone turned to you because you said or gave something: a small sound from them. */
  onAcknowledge?(who: string): void;
  /** State changes, for the paper ear and the cast's listening acting. */
  onState?(state: StoryState, who: string | null): void;
}

export function createStorySession(deps: SessionDeps) {
  const sessionId = `ev-${crypto.randomUUID().slice(0, 12)}`;
  let state: StoryState = 'opening';
  let generation = 0;
  let listener: string | null = null;
  let listeningSinceMs = 0;
  let quietTurns = 0;
  const history: StoryTurnRequest['history'] = [];

  let disposed = false;
  const setState = (next: StoryState, who: string | null = listener) => {
    if (disposed) return;
    state = next;
    deps.onState?.(next, who);
  };

  /** The light and the lamp as the timeline last left them. */
  const lightNow = (): { light: LightMood; lampLit: boolean } => {
    let light: LightMood = 'dusk';
    let lit = false;
    const ms = deps.nowMs();
    for (const item of deps.live.timeline()) {
      if (item.startMs > ms) continue;
      const a = item.action;
      if (a.do === 'light') light = a.mood;
      if (a.do === 'cue' && a.cue === 'lamp-lit') lit = true;
      if (a.do === 'cue' && a.cue === 'lamp-out') lit = false;
    }
    return { light, lampLit: lit };
  };

  async function turn(input: TurnInput): Promise<void> {
    if (disposed) return;
    const mine = ++generation;
    // A listen left over from the last turn mustn't end this one.
    pendingListen = false;
    if (input.kind === 'heard') {
      history.push({ who: 'reader', text: input.text });
      quietTurns = 0;
    }
    if (input.kind !== 'quiet') quietTurns = 0;
    setState('thinking');
    // At once, before the turn is written: whoever you spoke to turns to you, interested.
    if (input.kind === 'heard' || input.kind === 'gift') {
      const present = deps.cast().map((c) => c.id);
      const who = (input.kind === 'heard' && input.to && present.includes(input.to) ? input.to : null) ?? (listener && present.includes(listener) ? listener : present[0]);
      if (who) {
        deps.live.enqueue({ id: `ack-${mine}`, source: 'director', sceneId: null, estSeconds: 1, actions: [{ do: 'emote', withPrev: false, who, acting: 'look', target: 'reader' }], next: null, replaces: null });
        deps.onAcknowledge?.(who);
      }
    }
    const { light, lampLit } = lightNow();
    const request: StoryTurnRequest = {
      storyId: sessionId,
      turnId: `turn-${crypto.randomUUID().slice(0, 12)}`,
      phase: 'middle',
      activeSeconds: Math.max(0, deps.nowMs() / 1000),
      library: deps.library,
      stage: { setId: deps.live.setId, cast: deps.cast(), objects: deps.objects(), light, lampLit, ...(deps.roomFx ? { roomFx: deps.roomFx() } : {}) },
      room: deps.room(),
      input,
      history: history.slice(-120),
    };
    const started = performance.now();
    let first = true;
    const events = deps.stream(request);
    if (!events) {
      if (mine === generation) toListening(null);
      return;
    }
    try {
      for await (const event of events) {
        if (mine !== generation) return; // Interrupted: this turn is no longer the story.
        if (event.kind === 'beat') {
          const beat = event.ready.beat;
          // Voiced before it's queued, so the beat is timed by its real audio.
          const voiced = await Promise.all(linesOf(beat).map((l) => (event.ready.voice[l.lineId]?.url ? deps.sound.addLine(l.lineId, event.ready.voice[l.lineId]!.url!, event.ready.voice[l.lineId]!.durationMs) : Promise.resolve(false))));
          if (voiced.some((ok) => !ok)) deps.log?.('storyteller: a line has no voice (captions only)');
          if (mine !== generation) return;
          if (first) {
            first = false;
            deps.log?.(`storyteller: first beat ${Math.round(performance.now() - started)} ms after the turn began`);
          }
          for (const l of linesOf(beat)) history.push({ who: l.speaker, text: l.text });
          deps.live.enqueue(beat);
          setState('performing');
        } else if (event.kind === 'set') {
          deps.live.enqueueSet(event.setId, deps.cast().map((c) => c.id));
        } else if (event.kind === 'paint') {
          deps.onPaint?.(event);
        } else if (event.kind === 'redirect') {
          const beat: Beat = { id: `redirect-${generation}`, source: 'director', sceneId: null, estSeconds: 4, actions: [{ do: 'narrate', withPrev: false, text: event.text, mood: 'warm' }], next: null, replaces: null };
          const line = linesOf(beat)[0]!;
          if (event.voice.url) await deps.sound.addLine(line.lineId, event.voice.url, event.voice.durationMs);
          if (mine !== generation) return;
          deps.live.enqueue(beat);
          toListening(null);
          return;
        } else if (event.kind === 'listen') {
          toListening(event.who);
          return;
        } else if (event.kind === 'ending' || event.kind === 'recover') {
          toListening(null);
          return;
        } else if (event.kind === 'error') {
          deps.log?.(`storyteller turn failed: ${event.code}`);
          deps.onError?.(event.code, event.message);
          toListening(null);
          return;
        }
      }
    } catch (cause) {
      deps.log?.(`storyteller stream broke: ${String(cause)}`);
    }
    if (mine === generation) toListening(null);
  }

  function toListening(who: string | null): void {
    listener = who ?? listener;
    // They listen once what's queued has played; `frame` notices.
    setState(deps.live.idle ? 'listening' : 'performing', listener);
    listeningSinceMs = deps.nowMs();
    pendingListen = true;
  }
  let pendingListen = false;
  const arrivals: string[] = [];

  return {
    sessionId,
    get state() {
      return state;
    },
    get listener() {
      return listener;
    },
    open(): void {
      void turn({ kind: 'open' });
    },
    /** The reader said something. Interrupts whatever is playing. */
    heard(text: string, to: string | null = null): void {
      const t = text.trim();
      if (t.length < 2) return;
      if (state !== 'listening') deps.live.interrupt(deps.nowMs());
      void turn({ kind: 'heard', text: t.slice(0, 600), to });
    },
    /** You handed something over: it becomes the turn, even if they were mid-thought. */
    gift(objectId: string, castId: string): void {
      void turn({ kind: 'gift', objectId, castId });
    },
    /** Something painted has arrived: told as soon as they're listening, never over a scene. */
    arrived(objectId: string): void {
      if (state === 'listening') void turn({ kind: 'arrived', objectId });
      else arrivals.push(objectId);
    },
    /** Stop them mid-flow (a pinch on anyone): what's queued goes, and they listen. */
    interrupt(): void {
      generation += 1;
      deps.live.interrupt(deps.nowMs());
      toListening(listener);
    },
    /** This evening is over (started again, or left): nothing from it plays or answers any more. */
    dispose(): void {
      disposed = true;
      generation += 1;
    },
    frame(): void {
      if (disposed) return;
      const now = deps.nowMs();
      if (pendingListen && state === 'performing' && deps.live.idle) {
        setState('listening', listener);
        listeningSinceMs = now;
      }
      if (state === 'listening' && arrivals.length) {
        void turn({ kind: 'arrived', objectId: arrivals.shift()! });
        return;
      }
      if (state === 'listening') {
        pendingListen = false;
        if (now - listeningSinceMs > QUIET_MS && quietTurns < QUIET_TURNS) {
          quietTurns += 1;
          void turn({ kind: 'quiet', seconds: (now - listeningSinceMs) / 1000 });
        }
      }
    },
    /** Objects the backend painted, as defs, for the stage to register. */
    defs: new Map<string, ObjectDef>(),
  };
}
export type StorySession = ReturnType<typeof createStorySession>;
