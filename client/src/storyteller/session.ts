import {
  NO_STORY,
  SIGN_IN_REQUIRED,
  STORIES_TODAY_USED,
  STORY_OVER,
  STORYTELLER_RESTING,
  linesOf,
  type BackendApi,
  type EndReason,
  type LightMood,
  type ObjectDef,
  type RoomPlace,
  type ShowObject,
  type StageAction,
  type StageLibrary,
  type StageNow,
  type StoryPhase,
  type StoryTurnRequest,
  type TurnEvent,
  type TurnInput,
} from '@tabletop/contracts';
import type { SoundEngine } from '../sound/engine.ts';
import type { LiveScheduler } from './live.ts';
import type { RecordedId, RecordedLines } from './recorded.ts';

/**
 * One story with the AI Storyteller, as a turn state machine: listening, then thinking (the turn
 * is being written), then performing (its beats play), then listening again. Anything you do while
 * they think or perform starts a new generation: everything from the old one is dropped, so a late
 * line can never play over your interruption.
 *
 * The story has a shape, and the app owns its end (stage 2 of lane D's plan). It has about ten
 * active minutes, measured on the show clock (closing the book stops it). It winds down from 8:00
 * or turn 32. The close comes at 10:00 or turn 40, with a time bound. At 11:00 it stops, whatever
 * is still playing. The ending never needs the network: if the AI's close doesn't come, the
 * headset builds the page from what it already knows.
 */

export type StoryState = 'opening' | 'listening' | 'thinking' | 'performing';

/** How a story ended, for the end card and the shelf. `lines` has two or three; `things` are names. */
export interface StoryEnding {
  title: string;
  lines: string[];
  things: string[];
}

/** The title a story has before the cast names it. */
export const UNTITLED = "Tonight's story";

/** The story's shape, in active seconds and turns (owner, Nov 15: about 10 minutes, ending by turn 40). */
export const SHAPE = {
  closingAtS: 8 * 60,
  closeAtS: 10 * 60,
  hardStopS: 11 * 60,
  closingTurn: 32,
  /** The backend's limit, the close included: the close is sent once the turns before it are spent. */
  closeTurn: 40,
  /** How long the AI's close may take before the headset ends it itself. */
  closeBoundMs: 12_000,
  /** With nothing said this long into a turn, the recorded "where were we?" plays and the turn is dropped. */
  slowMs: 20_000,
  /** Quiet this long while they listen, and the story carries on by itself: at the welcome, and after. */
  quietWelcomeMs: 30_000,
  quietMs: 20_000,
} as const;

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
  /** The show clock. It stops while the book is closed. */
  nowMs(): number;
  log?(message: string): void;
  /** A painting the story asked for. */
  onPaint?(job: { jobId: string; objectId: string; description: string }): void;
  /** A turn failed: a reader who must sign in again (401), no connection, a limit, or the story slipped. */
  onError?(code: string, message: string): void;
  /** Someone turned to you because you said or gave something: a small sound from them. */
  onAcknowledge?(who: string): void;
  /** State changes, for the paper ear and the cast's listening acting. */
  onState?(state: StoryState, who: string | null): void;
  /** The story ended by itself (its time ran out, the connection was lost, tonight's limit). Not called for `end()`. */
  onEnded?(ending: StoryEnding): void;
  /** The set a redirect turns the page to: somewhere cozier. Defaults to the story's first set. */
  cozySet?: string;
  /** This book's recorded lines (`storyteller.json` → `recorded`): who says each, and the words. */
  recorded?: RecordedLines;
}

const CLOSING_LIGHT: StageAction[] = [
  { do: 'light', withPrev: false, mood: 'gold', seconds: 2 },
  { do: 'cue', withPrev: true, cue: 'lamp-lit', target: null },
  { do: 'cue', withPrev: false, cue: 'beam', target: null },
];

/** Up to three sentences of a summary, as the end card's lines. */
function sentencesOf(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]+["”']?/g) ?? [text]).map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

const listOf = (names: string[]): string => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

export function createStorySession(deps: SessionDeps) {
  /** Until the backend gives the story its id, the client's own (nothing paid is sent under it). */
  const sessionId = `ev-${crypto.randomUUID().slice(0, 12)}`;
  const requestId = `req-${crypto.randomUUID()}`;
  let storyId: string | null = null;
  let state: StoryState = 'opening';
  let generation = 0;
  let listener: string | null = null;
  let listeningSinceMs = 0;
  const history: StoryTurnRequest['history'] = [];

  let disposed = false;
  let ended = false;
  let closing = false;
  let suspended = false;
  let resumeWaiters: Array<() => void> = [];
  let storyTitle: string | null = null;
  let turns = 0;
  let startedAtMs: number | null = null;
  let offline = false;
  let redirects = 0;
  /** Names of things painted for this story that arrived on the page (not keepsakes from earlier stories). */
  const arrivedThings: string[] = [];
  const paintedIds = new Set<string>();
  /** The story's one ending, once it has ended: every way of ending settles it, and `end()` returns it. */
  let endingPromise: Promise<StoryEnding> | null = null;
  /** A forced stop (end(), the hard stop, a limit, a late close): nothing queued or still decoding plays after it. */
  let forced = false;

  const setState = (next: StoryState, who: string | null = listener) => {
    if (disposed || ended) return;
    state = next;
    deps.onState?.(next, who);
  };

  const activeS = (): number => (startedAtMs === null ? 0 : Math.max(0, (deps.nowMs() - startedAtMs) / 1000));
  const phase = (): StoryPhase => (storyTitle === null && turns < 3 ? 'welcome' : activeS() >= SHAPE.closingAtS || turns >= SHAPE.closingTurn ? 'closing' : 'middle');

  /** Holds the turn while the book is suspended; resolves at once otherwise. */
  const whileAwake = (): Promise<void> => (suspended ? new Promise((resolve) => resumeWaiters.push(resolve)) : Promise.resolve());

  /** A recorded line, played as a beat that speaks its words (the sound engine has its clip under the same line id). */
  /** The last failure line said, until something real is heard again: a failure line never repeats as filler. */
  let lastFailureLine: RecordedId | null = null;
  /** Failures to start the story in a row (the service, not the connection). */
  let startFailures = 0;
  /** Says a failure line, once: the same one again, with nothing real in between, is silence (PRD: never repeat filler). */
  const sayOnce = (id: RecordedId): void => {
    if (lastFailureLine === id) return;
    lastFailureLine = id;
    say(id);
  };
  const say = (id: RecordedId): void => {
    const line = deps.recorded?.[id];
    if (!line) return;
    const spoken: StageAction =
      line.speaker === 'narrator' || !deps.library.cast.some((c) => c.id === line.speaker)
        ? { do: 'narrate', withPrev: false, text: line.text, mood: 'warm' }
        : { do: 'speak', withPrev: false, who: line.speaker, text: line.text, mood: 'warm', to: 'reader' };
    deps.live.enqueue({ id: `recorded-${id}-${generation}-${Math.random().toString(36).slice(2, 6)}`, source: 'director', sceneId: null, estSeconds: 4, actions: [spoken], next: null, replaces: null });
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

  const castNames = (): string => listOf(deps.library.cast.filter((c) => c.voice !== null).map((c) => c.name));

  /** The end card's page from what the headset knows; the AI's summary when it came. */
  function endingOf(summary: string | null, title: string | null): StoryEnding {
    const name = title ?? storyTitle ?? UNTITLED;
    const things = [...new Set(arrivedThings)].slice(0, 12);
    const lines = summary
      ? sentencesOf(summary)
      : [
          name === UNTITLED ? `Tonight, ${castNames()} made up a story with you.` : `Tonight, ${castNames()} told “${name}” with you.`,
          things.length ? `Painted for it: ${listOf(things)}.` : 'Every word of it was made up as it went.',
          'It ends here, tucked into the book for another night.',
        ];
    return { title: name, lines: lines.length >= 2 ? lines : [...lines, 'It ends here, tucked into the book for another night.'], things };
  }

  /** The story is over: nothing more is heard or sent; the closing light and the beam play; the ending is told. */
  /**
   * The story is over. `forced` (end(), the hard stop, a limit, a late close) clears whatever is
   * queued at once; the AI's own closing lines, already queued, drain instead. Either way the
   * closing light and the beam play last, and the one ending is settled.
   */
  function finish(ending: StoryEnding, how: { recorded?: RecordedId; announce: boolean; forced: boolean }): Promise<StoryEnding> {
    if (ended) return endingPromise ?? Promise.resolve(ending);
    ended = true;
    forced = how.forced;
    generation += 1;
    resumeWaiters.splice(0).forEach((r) => r());
    if (how.forced) deps.live.interrupt(deps.nowMs());
    if (how.recorded) say(how.recorded);
    deps.live.enqueue({ id: `story-end-${generation}`, source: 'director', sceneId: null, estSeconds: 6, actions: CLOSING_LIGHT, next: null, replaces: null });
    deps.log?.(`storyteller: the story ended (${turns} turns, ${Math.round(activeS())} s)`);
    endingPromise = Promise.resolve(ending);
    if (how.announce) deps.onEnded?.(ending);
    return endingPromise;
  }

  /** The AI's close, bounded in time; the headset's own ending if it doesn't come. */
  async function close(reason: EndReason, announce: boolean): Promise<void> {
    if (closing || ended) return;
    closing = true;
    let aiEnding: { title: string; summary: string | null } | null = null;
    let heardAny = false;
    const bound = new Promise<'late'>((resolve) => setTimeout(() => resolve('late'), SHAPE.closeBoundMs));
    const result = await Promise.race([
      turn({ kind: 'close', reason }, (e) => {
        if (e.kind === 'ending') aiEnding = { title: e.title, summary: e.summary };
        if (e.kind === 'beat') heardAny = true;
      }),
      bound,
    ]);
    if (ended) return;
    const got = aiEnding as { title: string; summary: string | null } | null;
    if (result === 'late' || !got) {
      // Late or failed: the close is cut where it is, and the headset ends it.
      finish(endingOf(null, null), { recorded: heardAny ? undefined : 'close-fallback', announce, forced: true });
      return;
    }
    finish(endingOf(got.summary, got.title === UNTITLED ? null : got.title), { announce, forced: false });
  }

  /** Handles a refusal or failure, in story. True when the story has ended because of it. */
  function failed(code: string, message: string, opening = false): boolean {
    deps.onError?.(code, message);
    if (code === 'unauthorized' && message === SIGN_IN_REQUIRED) {
      finish(endingOf(null, null), { announce: true, forced: true });
      return true;
    }
    if (message === STORY_OVER) {
      finish(endingOf(null, null), { recorded: 'close-time', announce: true, forced: true });
      return true;
    }
    if (message === STORYTELLER_RESTING || message === STORIES_TODAY_USED || code === 'quota_exceeded' || message === NO_STORY) {
      finish(endingOf(null, null), { recorded: 'resting', announce: true, forced: true });
      return true;
    }
    if (/could not be reached|network failure|offline/i.test(message)) {
      // Offline: said once; the story waits, quietly, and the clock still brings its ending.
      if (!offline) sayOnce(opening ? 'welcome-fallback' : 'offline');
      offline = true;
      return false;
    }
    if (opening) {
      // The service itself won't start a story: after three tries it rests, properly, instead of looping.
      startFailures += 1;
      if (startFailures >= 3) {
        finish(endingOf(null, null), { recorded: 'resting', announce: true, forced: true });
        return true;
      }
      sayOnce('welcome-fallback');
      return false;
    }
    sayOnce('slow');
    return false;
  }

  /** Reserves the story on the backend before its first turn. */
  async function begin(): Promise<boolean> {
    if (storyId) return true;
    try {
      const started = await deps.withBackend((api) => api.startStory({ requestId }));
      if (!started) {
        failed('upstream_failed', 'the backend could not be reached', true);
        return false;
      }
      storyId = started.storyId;
      startFailures = 0;
      return true;
    } catch (cause) {
      const e = cause as { code?: string; message?: string };
      failed(e.code ?? 'upstream_failed', e.message ?? String(cause), true);
      return false;
    }
  }

  /**
   * Whether a turn has been overtaken: disposed, stopped by force, or (for any turn but the close)
   * interrupted or ended. Checked after every wait, before anything from it is played.
   */
  const gone = (mine: number, input: TurnInput): boolean => {
    if (disposed || forced) return true;
    if (input.kind === 'close') return false;
    return ended || mine !== generation;
  };

  /** The close needs a turn of its own, so ordinary turns stop one short of the limit. */
  const turnsLeftForStory = (): boolean => turns < SHAPE.closeTurn - 1;

  async function turn(input: TurnInput, watch?: (e: TurnEvent) => void): Promise<void> {
    if (disposed || (ended && input.kind !== 'close')) return;
    if (input.kind !== 'close' && !turnsLeftForStory()) {
      void close('turns', true);
      return;
    }
    const mine = ++generation;
    pendingListen = false;
    if (input.kind === 'heard') history.push({ who: 'reader', text: input.text });
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
    if (!(await begin()) || mine !== generation) {
      if (mine === generation) toListening(null);
      return;
    }
    const { light, lampLit } = lightNow();
    const request: StoryTurnRequest = {
      storyId: storyId!,
      turnId: `turn-${crypto.randomUUID()}`,
      phase: phase(),
      activeSeconds: activeS(),
      library: deps.library,
      stage: { setId: deps.live.setId, cast: deps.cast(), objects: deps.objects(), light, lampLit, ...(deps.roomFx ? { roomFx: deps.roomFx() } : {}) },
      room: deps.room(),
      input,
      history: history.slice(-120),
    };
    turns += 1;
    const started = performance.now();
    let first = true;
    // Nothing heard for too long: the recorded line, and the turn is let go.
    const slow = setTimeout(() => {
      if (mine !== generation || !first || ended || input.kind === 'close') return;
      generation += 1;
      say('slow');
      toListening(null);
    }, SHAPE.slowMs);
    const events = deps.stream(request);
    if (!events) {
      clearTimeout(slow);
      if (mine === generation) {
        failed('upstream_failed', 'the backend could not be reached');
        toListening(null);
      }
      return;
    }
    try {
      for await (const event of events) {
        await whileAwake();
        if (gone(mine, input)) return; // Interrupted, stopped or disposed: this turn is no longer the story.
        watch?.(event);
        if (offline && event.kind === 'beat') {
          offline = false;
          say('online');
        }
        if (event.kind === 'beat') {
          const beat = event.ready.beat;
          // Voiced before it's queued, so the beat is timed by its real audio.
          const voiced = await Promise.all(linesOf(beat).map((l) => (event.ready.voice[l.lineId]?.url ? deps.sound.addLine(l.lineId, event.ready.voice[l.lineId]!.url!, event.ready.voice[l.lineId]!.durationMs) : Promise.resolve(false))));
          if (voiced.some((ok) => !ok)) deps.log?.('storyteller: a line has no voice (captions only)');
          if (gone(mine, input)) return;
          if (first) {
            first = false;
            deps.log?.(`storyteller: first beat ${Math.round(performance.now() - started)} ms after the turn began`);
          }
          for (const l of linesOf(beat)) history.push({ who: l.speaker, text: l.text });
          lastFailureLine = null;
          deps.live.enqueue(beat);
          setState('performing');
        } else if (event.kind === 'set') {
          deps.live.enqueueSet(event.setId, deps.cast().map((c) => c.id));
        } else if (event.kind === 'paint') {
          paintedIds.add(event.objectId);
          deps.onPaint?.(event);
        } else if (event.kind === 'titled') {
          storyTitle = event.title;
        } else if (event.kind === 'redirect') {
          // The words that led here leave the history, so they don't come back; the page really turns.
          if (input.kind === 'heard' && history.at(-1)?.who === 'reader') history.pop();
          say(redirects++ % 2 === 0 ? 'redirect-a' : 'redirect-b');
          const cozy = deps.cozySet ?? deps.library.sets[0]?.id;
          if (cozy && cozy !== deps.live.setId) deps.live.enqueueSet(cozy, deps.cast().map((c) => c.id));
          toListening(null);
          return;
        } else if (event.kind === 'listen') {
          toListening(event.who);
          return;
        } else if (event.kind === 'ending') {
          return;
        } else if (event.kind === 'recover') {
          // This turn id already ran: nothing is performed again.
          say('slow');
          toListening(null);
          return;
        } else if (event.kind === 'error') {
          deps.log?.(`storyteller turn failed: ${event.code}`);
          if (input.kind !== 'close' && !failed(event.code, event.message, input.kind === 'open')) toListening(null);
          return;
        }
      }
    } catch (cause) {
      deps.log?.(`storyteller stream broke: ${String(cause)}`);
      if (input.kind !== 'close') say('slow');
    } finally {
      clearTimeout(slow);
    }
    if (mine === generation && input.kind !== 'close') toListening(null);
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
    /** The backend's id for this story, once it has one. */
    get storyId() {
      return storyId;
    },
    get state() {
      return state;
    },
    get listener() {
      return listener;
    },
    /** True once the story has ended: nothing more is heard, sent or played from it. */
    get ended() {
      return ended;
    },
    /** The book has opened: the story's clock starts, and the cast greets you. */
    open(): void {
      startedAtMs ??= deps.nowMs();
      void turn({ kind: 'open' });
    },
    /** The reader said something. Interrupts whatever is playing. */
    heard(text: string, to: string | null = null): void {
      const t = text.trim();
      if (t.length < 2 || ended || closing) return;
      if (state !== 'listening') deps.live.interrupt(deps.nowMs());
      void turn({ kind: 'heard', text: t.slice(0, 600), to });
    },
    /** You handed something over: it becomes the turn, even if they were mid-thought. At the welcome, it's the premise. */
    gift(objectId: string, castId: string): void {
      if (ended || closing) return;
      void turn({ kind: 'gift', objectId, castId });
    },
    /** Something painted has arrived: told as soon as they're listening, never over a scene. */
    arrived(objectId: string): void {
      if (ended) return;
      const thing = deps.objects().find((o) => o.id === objectId);
      if (thing && paintedIds.has(objectId)) arrivedThings.push(thing.def.name);
      if (state === 'listening') void turn({ kind: 'arrived', objectId });
      else arrivals.push(objectId);
    },
    /** A painting didn't come (it failed, or failed the look check): whoever fetched it comes back empty-handed. */
    paintMissed(): void {
      if (!ended) say('finder-empty');
    },
    /** Stop them mid-flow (a pinch on anyone): what's queued goes, and they listen. */
    interrupt(): void {
      if (ended) return;
      generation += 1;
      deps.live.interrupt(deps.nowMs());
      toListening(listener);
    },
    /** A page is open, the cover is shut, or the headset is off: hold everything in order. */
    suspend(): void {
      suspended = true;
    },
    /** Play what was held, in order. */
    resume(): void {
      suspended = false;
      resumeWaiters.splice(0).forEach((r) => r());
    },
    /** "End the story here": ends at once, on the headset, with no network needed, and resolves with its ending. */
    end(): Promise<StoryEnding> {
      if (endingPromise) return endingPromise;
      return finish(endingOf(null, null), { recorded: 'close-fallback', announce: false, forced: true });
    },
    /** The story's title once it has one (for the pause card), or null. */
    title(): string | null {
      return storyTitle;
    },
    /** This story is over (started again, or left): nothing from it plays or answers any more. */
    dispose(): void {
      disposed = true;
      generation += 1;
      resumeWaiters.splice(0).forEach((r) => r());
    },
    frame(): void {
      if (disposed || ended || suspended) return;
      const now = deps.nowMs();
      // The app owns the end: the hard stop first, then the close.
      if (startedAtMs !== null && activeS() >= SHAPE.hardStopS) {
        deps.live.interrupt(now);
        finish(endingOf(null, null), { recorded: 'close-time', announce: true, forced: true });
        return;
      }
      if (pendingListen && state === 'performing' && deps.live.idle) {
        setState('listening', listener);
        listeningSinceMs = now;
      }
      if (state === 'listening' && !closing && (activeS() >= SHAPE.closeAtS || !turnsLeftForStory())) {
        const reason: EndReason = turnsLeftForStory() ? 'time' : 'turns';
        void close(reason, true);
        return;
      }
      if (state === 'listening' && arrivals.length) {
        void turn({ kind: 'arrived', objectId: arrivals.shift()! });
        return;
      }
      if (state === 'listening' && !closing) {
        pendingListen = false;
        // Silence is a whole way to play: every question has a timed default.
        const quiet = phase() === 'welcome' ? SHAPE.quietWelcomeMs : SHAPE.quietMs;
        if (now - listeningSinceMs > quiet) void turn({ kind: 'quiet', seconds: (now - listeningSinceMs) / 1000 });
      }
    },
    /** Objects the backend painted, as defs, for the stage to register. */
    defs: new Map<string, ObjectDef>(),
  };
}
export type StorySession = ReturnType<typeof createStorySession>;
