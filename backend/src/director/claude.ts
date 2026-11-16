import Anthropic from '@anthropic-ai/sdk';
import { BackendError } from '@tabletop/contracts';
import type { z } from 'zod';

/** As the technical design names them: Sonnet plans, Haiku reacts. */
export const PLANNER = 'claude-sonnet-5-5';
export const REACTOR = 'claude-haiku-5-5';

export interface AskOptions<T> {
  model: typeof PLANNER | typeof REACTOR;
  system: string;
  user: string;
  /** A JSON Schema the response must match, and the zod twin that checks it again. */
  schema: Record<string, unknown>;
  parse: z.ZodType<T>;
  maxTokens: number;
  timeoutMs: number;
  /** A picture to look at with the words. */
  image?: { mime: 'image/jpeg' | 'image/png'; base64: string };
  /** Kept for the log: what kind of call this is. The reservation is computed from the call itself. */
  estimate?: SpendEstimate;
}

/** A picture's input tokens, at most, for a cut-out of up to 1024 x 1024 (about width x height / 750). */
const IMAGE_TOKENS = 1_600;

/**
 * An upper bound on a call's tokens, reserved before it's made: every character of the prompt as a
 * token at most one in three (English runs about four), the picture, and the whole output allowed.
 */
export function tokenBound(system: string, user: string, maxTokens: number, image: boolean): number {
  return Math.ceil((system.length + user.length) / 3) + (image ? IMAGE_TOKENS : 0) + maxTokens;
}

export interface Claude {
  ask<T>(options: AskOptions<T>): Promise<T>;
}

export type SpendEstimate = 'turn' | 'checkLine' | 'checkInput' | 'name' | 'vision';

/**
 * The spend ledger, seen from a paid call: reserve the estimate first (null means the day's
 * ceiling is reached, and the call isn't made), then settle to the real usage, or null when it
 * isn't known, which keeps the whole reservation.
 */
export interface SpendGate {
  reserve(tokens: number): unknown | null;
  settle(reservation: unknown, tokens: number | null): void;
}

/** One structured call. Any refusal, timeout or wrong shape is a BackendError, which the client turns into the authored path. */
export function createClaude(apiKey: string, log: (message: string, cause?: unknown) => void = console.error, spend: SpendGate | null = null): Claude {
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  return {
    async ask({ model, system, user, schema, parse, maxTokens, timeoutMs, image }) {
      const started = Date.now();
      const reservation = spend ? spend.reserve(tokenBound(system, user, maxTokens, Boolean(image))) : null;
      if (spend && reservation === null) throw new BackendError('quota_exceeded', 'the day\'s spending is used up');
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await client.beta.messages.create(
          {
            model,
            max_tokens: maxTokens,
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages: [
              {
                role: 'user',
                content: image ? [{ type: 'image', source: { type: 'base64', media_type: image.mime, data: image.base64 } }, { type: 'text', text: user }] : user,
              },
            ],
            output_config: { format: { type: 'json_schema', schema }, effort: model === PLANNER ? 'medium' : 'low' },
            // Sonnet 5.5 turns thinking off with between_tools; Haiku 5.5 takes disabled at low effort.
            thinking: model === PLANNER ? { type: 'between_tools' } : { type: 'disabled' },
            // A declined request is retried on another model by the server, rather than failing the beat.
            ...(model === PLANNER ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          },
          { timeout: timeoutMs },
        );
      } catch (cause) {
        if (spend) spend.settle(reservation, null);
        if (cause instanceof Anthropic.RateLimitError) throw new BackendError('quota_exceeded', 'the model is rate limited', true);
        if (cause instanceof Anthropic.APIConnectionTimeoutError) throw new BackendError('upstream_failed', 'the model was too slow', true);
        if (cause instanceof Anthropic.APIError) {
          log(`claude ${model} answered ${cause.status}`, cause.message);
          throw new BackendError('upstream_failed', `the model answered ${cause.status}`, true);
        }
        throw new BackendError('upstream_failed', 'the model could not be reached', true);
      }
      const u = response.usage;
      if (spend) spend.settle(reservation, u.input_tokens + u.output_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0));
      if (response.stop_reason === 'refusal') throw new BackendError('moderated', 'the model declined');
      if (response.stop_reason === 'max_tokens') throw new BackendError('invalid_output', 'the answer was cut off');
      const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new BackendError('invalid_output', 'the answer was not JSON');
      }
      const parsed = parse.safeParse(value);
      if (!parsed.success) throw new BackendError('invalid_output', 'the answer had the wrong shape');
      log(`claude ${response.model} ${Date.now() - started} ms, in ${u.input_tokens} (cache ${u.cache_read_input_tokens ?? 0}), out ${u.output_tokens}`);
      return parsed.data;
    },
  };
}
