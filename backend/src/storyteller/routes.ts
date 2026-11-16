import Anthropic from '@anthropic-ai/sdk';
import {
  BackendError,
  LISTENING_BUSY,
  NO_STORY,
  PAINTINGS_USED,
  STORYTELLER_RESTING,
  type BackendApi,
  type PaintRequest,
  type StoryPage,
  type StoryRecord,
  type StoryTurnRequest,
  type TurnEvent,
} from '@tabletop/contracts';
import { tokenBound, type SpendGate } from '../director/claude.ts';
import { currentUser } from '../guard.ts';
import { MAX_HOLD_S, billedSecondsOf, opusSeconds, type Transcriber } from './listen.ts';
import type { Painter } from './paint.ts';
import { SPEND_ESTIMATE, type Stories } from './stories.ts';
import { RULES, TURN_MAX_PROMPT_CHARS, TURN_MAX_TOKENS, UNTITLED, contextOf, storyTurn, type StoryContext, type TurnDeps } from './turn.ts';
import { estimateTtsCost, type Voices } from './voices.ts';

/**
 * The AI Storyteller's routes over the story store. The guard has already made sure the caller is
 * a signed-in reader and the Storyteller is on; every handler here acts only for that reader.
 */

export interface StorytellerDeps {
  stories: Stories;
  anthropic: Anthropic;
  voices: Voices;
  painter: Painter;
  moderate?: (text: string) => Promise<boolean>;
  checkLine: (text: string) => Promise<boolean>;
  /** Hold to talk: the clip, heard by the speech provider. */
  transcriber: Transcriber;
  /** Voices that count their characters for this story (falls back to `voices`). */
  storyVoices?: (storyId: string) => Voices;
  /** The Storyteller's AI is on (TT_STORYTELLER isn't off). Off, a story still ends, with trusted copy and no paid checks. */
  aiOn?: () => boolean;
  /** Paintings this story may still ask for (0 when painting is off). */
  paintsLeft?: (story: { paints: number }) => number;
  log?: (message: string) => void;
}

const reader = (): string => {
  const userId = currentUser();
  // The guard lets nobody else in; this is the second lock on the same door.
  if (!userId) throw new BackendError('unauthorized', 'sign in to use the AI Storyteller');
  return userId;
};

/** The spend ledger as a Claude call sees it. */
export function claudeSpend(stories: Stories): SpendGate {
  return {
    reserve: (tokens) => stories.reserveSpend('claude', tokens),
    settle: (reservation, tokens) => stories.settleSpend(reservation as NonNullable<ReturnType<Stories['reserveSpend']>>, tokens),
  };
}

/**
 * Voices that reserve their characters before each call. At the day's ceiling, or when the voice
 * service fails (its quota spent, or down), a line goes out as captions only, and the log says why.
 * With a story id, its characters are also counted for that story, to measure what a story costs.
 */
export function spendingVoices(voices: Voices, stories: Stories, storyId: string | null = null, log: (m: string) => void = console.log): Voices {
  return {
    get characters() {
      return voices.characters;
    },
    sound: async () => null,
    async speak(speaker, text) {
      const reservation = stories.reserveSpend('tts', text.length);
      if (!reservation) {
        log("voices: captions only (the day's voice ceiling is reached)");
        return null;
      }
      const voice = await voices.speak(speaker, text).catch(() => null);
      // A failed call may still have been charged: the reservation stays, and the story counts it.
      if (voice) stories.settleSpend(reservation, text.length);
      else log('voices: captions only (the voice service did not answer)');
      if (storyId) stories.addStorySpend(storyId, 'tts', text.length);
      return voice;
    },
  };
}

/**
 * Trusted copy for a page when nothing may be checked (the AI is off): the title the story was
 * given (checked when it was named) or the untitled name, and no summary. The things are filtered
 * by the store to checked names of paintings that really arrived.
 */
function trustedPage(title: string | null, page: StoryPage): StoryPage {
  return { title: title ?? UNTITLED, summary: null, things: page.things };
}

/** The checked title and summary for a saved page; a part that fails its check falls back, never saved unchecked. */
async function checkedPage(page: StoryPage, check: (text: string) => Promise<boolean>): Promise<StoryPage> {
  const [titleOk, summaryOk] = await Promise.all([check(page.title).catch(() => false), page.summary ? check(page.summary).catch(() => false) : Promise.resolve(true)]);
  return { title: titleOk ? page.title : UNTITLED, summary: summaryOk ? page.summary : null, things: page.things };
}

export function storytellerHandlers(deps: StorytellerDeps): Pick<
  BackendApi,
  'storytellerAvailability' | 'startStory' | 'storyTurn' | 'endStory' | 'listStories' | 'paintProp' | 'paintResult' | 'transcribe' | 'soundEffect'
> {
  const { stories } = deps;
  /** Completions being saved, by reader and story. */
  const ending = new Map<string, Promise<{ record: StoryRecord }>>();

  async function* turn(request: StoryTurnRequest): AsyncGenerator<TurnEvent> {
    const userId = reader();
    // The reader's own story, before anything else.
    const owned = stories.get(userId, request.storyId);
    if (!owned) {
      yield { kind: 'error', code: 'bad_request', message: NO_STORY };
      return;
    }
    const story: StoryContext = {
      title: owned.title,
      plan: owned.plan,
      recent: request.input.kind === 'open' ? stories.recent(userId, 3) : [],
      ...(deps.paintsLeft ? { paintsLeft: deps.paintsLeft(owned) } : {}),
    };
    // The prompt is bounded before anything is claimed or paid for, and its cost reserved from its real size.
    const prompt = contextOf(request, story);
    if (RULES.length + prompt.length > TURN_MAX_PROMPT_CHARS) {
      yield { kind: 'error', code: 'bad_request', message: 'the turn is too long' };
      return;
    }
    // A turn id runs once: a repeat or a copy in flight recovers, and nothing paid runs again.
    let claim: 'run' | 'recover';
    try {
      claim = stories.claimTurn(userId, request.storyId, request.turnId);
    } catch (cause) {
      const error = cause instanceof BackendError ? cause : new BackendError('upstream_failed', 'the story slipped', true);
      yield { kind: 'error', code: error.code, message: error.message };
      return;
    }
    if (claim === 'recover') {
      yield { kind: 'recover' };
      return;
    }
    const reserved = tokenBound(RULES, prompt, TURN_MAX_TOKENS, false);
    const reservation = stories.reserveSpend('claude', reserved);
    if (!reservation) {
      yield { kind: 'error', code: 'upstream_failed', message: STORYTELLER_RESTING };
      return;
    }
    const turnDeps: TurnDeps = {
      anthropic: deps.anthropic,
      voices: deps.storyVoices ? deps.storyVoices(request.storyId) : deps.voices,
      checkLine: deps.checkLine,
      story,
      onTitle: (title, plan) => stories.setTitle(request.storyId, title, plan),
      onUsage: (tokens) => {
        stories.settleSpend(reservation, tokens);
        stories.addStorySpend(request.storyId, 'claude', tokens ?? reserved);
      },
      paint: (storyId, description, objectId) => deps.painter.start(userId, { storyId, objectId, description, image: null }),
      ...(deps.moderate ? { moderate: deps.moderate } : {}),
      ...(deps.log ? { log: deps.log } : {}),
    };
    yield* storyTurn(request, turnDeps);
  }

  return {
    storytellerAvailability: async () => stories.availability(reader()),
    startStory: async (request) => stories.start(reader(), request.requestId),
    storyTurn: (request) => turn(request),
    endStory: async (request) => {
      const userId = reader();
      // The reader's own story, before any paid check.
      const row = stories.get(userId, request.storyId);
      if (!row) throw new BackendError('bad_request', NO_STORY);
      // Already saved: the record, with nothing checked or saved again.
      if (row.status === 'ended') return { record: stories.record(userId, request.storyId)! };
      // One completion per story: a retry while it's being saved shares it.
      const key = `${userId}/${request.storyId}`;
      const running = ending.get(key);
      if (running) return running;
      const done = (async () => {
        // Off, a story still ends: trusted copy, and no paid checks.
        const page = (deps.aiOn ?? (() => true))() ? await checkedPage(request.page, deps.checkLine) : trustedPage(row.title, request.page);
        const record = stories.end(userId, request.storyId, request.reason, page);
        const used = stories.storySpend(request.storyId);
        // Voices: about 15 characters a second of audio. Listening: Groq's $0.04 an hour. Claude: logged as tokens.
        const voicesUsd = estimateTtsCost(used.tts ?? 0, ((used.tts ?? 0) / 15) * 1000);
        const listeningUsd = ((used.stt ?? 0) / 3600) * 0.04;
        deps.log?.(`storyteller: story ended (${request.reason}); used ${JSON.stringify(used)}; voices about $${voicesUsd.toFixed(3)}, listening about $${listeningUsd.toFixed(4)}`);
        return { record };
      })().finally(() => ending.delete(key));
      ending.set(key, done);
      return done;
    },
    listStories: async () => ({ stories: stories.list(reader()) }),
    paintProp: async (request: PaintRequest) => {
      const jobId = deps.painter.start(reader(), request);
      if (!jobId) throw new BackendError('quota_exceeded', PAINTINGS_USED);
      return { jobId };
    },
    paintResult: async ({ jobId }) => {
      // Only the reader whose story asked for it can collect it.
      if (stories.paintOwner(jobId) !== reader()) return { status: 'failed', reason: 'no such painting' };
      return deps.painter.result(jobId);
    },
    transcribe: async (request) => {
      const userId = reader();
      // Only Opus in WebM or Ogg (what the headset records), its length read from the clip itself.
      if (request.audio.mime !== 'audio/webm' && request.audio.mime !== 'audio/ogg') throw new BackendError('bad_request', 'only Opus in WebM or Ogg is heard');
      const seconds = opusSeconds(request.audio.mime, Buffer.from(request.audio.base64, 'base64'));
      if (seconds === null) throw new BackendError('bad_request', 'the clip could not be read');
      if (seconds > MAX_HOLD_S) throw new BackendError('bad_request', 'the clip is longer than a hold');
      // That exact story, the reader's own, in progress; counted per reader per day.
      stories.claimHold(userId, request.storyId);
      const billed = billedSecondsOf(seconds);
      const reservation = stories.reserveSpend('stt', billed);
      if (!reservation) throw new BackendError('quota_exceeded', LISTENING_BUSY, true);
      try {
        const heard = await deps.transcriber.transcribe(request.audio);
        // The provider's own figure, never more than the clip we measured could be.
        const actual = billedSecondsOf(Math.min(heard.seconds ?? seconds, MAX_HOLD_S, seconds + 1));
        stories.settleSpend(reservation, actual);
        stories.addStorySpend(request.storyId, 'stt', actual);
        return { text: heard.text };
      } catch (cause) {
        // An unknown outcome keeps its reservation.
        stories.settleSpend(reservation, null);
        throw cause;
      }
    },
    // No caller yet (v2's SOUND step): budgeted at zero.
    soundEffect: async () => {
      throw new BackendError('quota_exceeded', 'live sound effects are off');
    },
  };
}
