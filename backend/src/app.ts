import {
  BackendError,
  CONTRACT_HEADER,
  CONTRACT_VERSION,
  routes,
  type BackendApi,
  type ErrorBody,
  type ErrorCode,
  type ReplyChunk,
} from '@tabletop/contracts';
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';

const STATUS = {
  bad_request: 400,
  unauthorized: 401,
  contract_mismatch: 409,
  moderated: 422,
  quota_exceeded: 429,
  upstream_failed: 502,
  invalid_output: 502,
} as const satisfies Record<ErrorCode, number>;

function errorResponse(c: Context, error: BackendError): Response {
  const body: ErrorBody = { error: { code: error.code, retryable: error.retryable, message: error.message } };
  return c.json(body, STATUS[error.code]);
}

type AnyMethod = (request: unknown) => Promise<unknown> | AsyncIterable<ReplyChunk>;

/** Mounts the route table over any BackendApi. Deploy swaps real handlers in route by route. */
export function createApp(api: BackendApi, log: (message: string, cause: unknown) => void = console.error): Hono {
  const app = new Hono();

  app.get('/healthz', (c) => c.json({ ok: true, contract: CONTRACT_VERSION }));

  app.use('/v1/*', async (c, next) => {
    const sent = c.req.header(CONTRACT_HEADER);
    if (sent !== String(CONTRACT_VERSION)) {
      return errorResponse(c, new BackendError('contract_mismatch', `this server speaks contract ${CONTRACT_VERSION}`));
    }
    await next();
    return undefined;
  });

  for (const [name, route] of Object.entries(routes)) {
    const method = api[name as keyof BackendApi] as AnyMethod;

    app.post(route.path, async (c) => {
      let body: unknown;
      try {
        body = JSON.parse(await c.req.text());
      } catch {
        return errorResponse(c, new BackendError('bad_request', 'the body is not JSON'));
      }
      const parsed = route.request.safeParse(body);
      if (!parsed.success) return errorResponse(c, new BackendError('bad_request', `the body does not match ${route.path}`));

      if ('stream' in route) {
        return streamSSE(c, async (stream) => {
          try {
            for await (const chunk of method(parsed.data) as AsyncIterable<ReplyChunk>) {
              await stream.writeSSE({ data: JSON.stringify(chunk) });
            }
          } catch (cause) {
            log(`stream ${route.path} failed`, cause);
            const chunk: ReplyChunk = { kind: 'error', code: 'upstream_failed', message: 'the reply failed' };
            await stream.writeSSE({ data: JSON.stringify(chunk) });
          }
        });
      }
      return c.json((await method(parsed.data)) as object);
    });
  }

  app.onError((cause, c) => {
    if (cause instanceof BackendError) return errorResponse(c, cause);
    log('unexpected backend error', cause);
    return errorResponse(c, new BackendError('upstream_failed', 'the backend hit a problem', true));
  });

  return app;
}

export interface Listen {
  port: number;
  host: string;
}

/**
 * Dev always takes this workspace's port file, so an inherited PORT can't make two
 * workspaces collide. Production requires PORT, which the host sets.
 */
export function resolveListen(
  argv: string[],
  env: Record<string, string | undefined>,
  readPorts: () => { BACKEND_PORT: number },
): Listen {
  if (argv.includes('--dev')) return { port: readPorts().BACKEND_PORT, host: '127.0.0.1' };
  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port <= 0) throw new Error('production needs a numeric PORT');
  return { port, host: '0.0.0.0' };
}
