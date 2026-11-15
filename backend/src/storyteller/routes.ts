import Anthropic from '@anthropic-ai/sdk';
import {
  BackendError,
  PAINTINGS_USED,
  STORYTELLER_RESTING,
  type BackendApi,
  type PaintRequest,
  type StoryPage,
  type StoryTurnRequest,
  type TurnEvent,
} from '@tabletop/contracts';
import type { SpendGate } from '../director/claude.ts';
import { currentUser } from '../guard.ts';
import type { Painter } from './paint.ts';
import { SPEND_ESTIMATE, type Stories } from './stories.ts';
import { UNTITLED, storyTurn, type TurnDeps } from './turn.ts';
import type { Voices } from './voices.ts';

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
  /** A single-use token for listening, from the speech vendor. */
  speechToken: () => Promise<{ provider: string; token: string; expiresAt: string }>;
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
    reserve: (estimate) => stories.reserveSpend('claude', SPEND_ESTIMATE[estimate]),
    settle: (reservation, tokens) => stories.settleSpend(reservation as NonNullable<ReturnType<Stories['reserveSpend']>>, tokens),
  };
}

/** Voices that reserve their characters before each call. At the day's ceiling a line goes out as captions only. */
export function spendingVoices(voices: Voices, stories: Stories): Voices {
  return {
    get characters() {
      return voices.characters;
    },
    sound: async () => null,
    async speak(speaker, text) {
      const reservation = stories.reserveSpend('tts', text.length);
      if (!reservation) return null;
      const voice = await voices.speak(speaker, text).catch(() => null);
      // A failed call may still have been charged: the reservation stays.
      if (voice) stories.settleSpend(reservation, text.length);
      return voice;
    },
  };
}

/** The checked title and summary for a saved page; a part that fails its check falls back, never saved unchecked. */
async function checkedPage(page: StoryPage, check: (text: string) => Promise<boolean>): Promise<StoryPage> {
  const [titleOk, summaryOk] = await Promise.all([check(page.title).catch(() => false), page.summary ? check(page.summary).catch(() => false) : Promise.resolve(true)]);
  return { title: titleOk ? page.title : UNTITLED, summary: summaryOk ? page.summary : null, things: page.things };
}

export function storytellerHandlers(deps: StorytellerDeps): Pick<
  BackendApi,
  'storytellerAvailability' | 'startStory' | 'storyTurn' | 'endStory' | 'listStories' | 'paintProp' | 'paintResult' | 'speechToken' | 'soundEffect'
> {
  const { stories } = deps;

  async function* turn(request: StoryTurnRequest): AsyncGenerator<TurnEvent> {
    const userId = reader();
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
    const row = stories.get(userId, request.storyId)!;
    const reservation = stories.reserveSpend('claude', SPEND_ESTIMATE.turn);
    if (!reservation) {
      yield { kind: 'error', code: 'upstream_failed', message: STORYTELLER_RESTING };
      return;
    }
    const turnDeps: TurnDeps = {
      anthropic: deps.anthropic,
      voices: deps.voices,
      checkLine: deps.checkLine,
      story: { title: row.title, plan: row.plan, recent: request.input.kind === 'open' ? stories.recent(userId, 3) : [], paintsLeft: deps.paintsLeft ? deps.paintsLeft(row) : undefined },
      onTitle: (title, plan) => stories.setTitle(request.storyId, title, plan),
      onUsage: (tokens) => stories.settleSpend(reservation, tokens),
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
      // Already ended: the saved record, with no second check.
      const row = stories.get(userId, request.storyId);
      if (row && row.status === 'ended') return { record: stories.end(userId, request.storyId, request.reason, request.page) };
      return { record: stories.end(userId, request.storyId, request.reason, await checkedPage(request.page, deps.checkLine)) };
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
    speechToken: async () => {
      stories.claimSpeechToken(reader());
      const reservation = stories.reserveSpend('stt', 1);
      if (!reservation) throw new BackendError('upstream_failed', STORYTELLER_RESTING, false);
      return deps.speechToken();
    },
    // No caller yet (v2's SOUND step): budgeted at zero.
    soundEffect: async () => {
      throw new BackendError('quota_exceeded', 'live sound effects are off');
    },
  };
}
