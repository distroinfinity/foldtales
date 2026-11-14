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
}

export interface Claude {
  ask<T>(options: AskOptions<T>): Promise<T>;
}

/** One structured call. Any refusal, timeout or wrong shape is a BackendError, which the client turns into the authored path. */
export function createClaude(apiKey: string, log: (message: string, cause?: unknown) => void = console.error): Claude {
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  return {
    async ask({ model, system, user, schema, parse, maxTokens, timeoutMs }) {
      const started = Date.now();
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await client.beta.messages.create(
          {
            model,
            max_tokens: maxTokens,
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: user }],
            output_config: { format: { type: 'json_schema', schema }, effort: model === PLANNER ? 'medium' : 'low' },
            // Sonnet 5.5 turns thinking off with between_tools; Haiku 5.5 takes disabled at low effort.
            thinking: model === PLANNER ? { type: 'between_tools' } : { type: 'disabled' },
            // A declined request is retried on another model by the server, rather than failing the beat.
            ...(model === PLANNER ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          },
          { timeout: timeoutMs },
        );
      } catch (cause) {
        if (cause instanceof Anthropic.RateLimitError) throw new BackendError('quota_exceeded', 'the model is rate limited', true);
        if (cause instanceof Anthropic.APIConnectionTimeoutError) throw new BackendError('upstream_failed', 'the model was too slow', true);
        if (cause instanceof Anthropic.APIError) {
          log(`claude ${model} answered ${cause.status}`, cause.message);
          throw new BackendError('upstream_failed', `the model answered ${cause.status}`, true);
        }
        throw new BackendError('upstream_failed', 'the model could not be reached', true);
      }
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
      const u = response.usage;
      log(`claude ${response.model} ${Date.now() - started} ms, in ${u.input_tokens} (cache ${u.cache_read_input_tokens ?? 0}), out ${u.output_tokens}`);
      return parsed.data;
    },
  };
}
