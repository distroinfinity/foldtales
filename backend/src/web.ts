import { createHash, timingSafeEqual } from 'node:crypto';
import { BackendError, CONTRACT_HEADER } from '@tabletop/contracts';
import type { Hono, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { errorResponse } from './app.ts';
import type { Store } from './store.ts';

const MAX_BODY_BYTES = 512 * 1024;

/** True for https on the client's own host or a real subdomain of it. */
export function isAllowedOrigin(origin: string, clientHost: string | undefined): boolean {
  if (!clientHost) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && (url.hostname === clientHost || url.hostname.endsWith(`.${clientHost}`));
}

export function browserAccess(clientHost: string | undefined): MiddlewareHandler[] {
  return [
    cors({
      origin: (origin) => (isAllowedOrigin(origin, clientHost) ? origin : null),
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization', CONTRACT_HEADER],
      maxAge: 600,
    }),
    bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => errorResponse(c, new BackendError('bad_request', 'the body is too large')) }),
  ];
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Read-only, outside the contract, for the telemetry report. It doesn't exist unless a token is configured. */
export function adminTelemetry(store: Store, adminToken: string | undefined): (app: Hono) => void {
  return (app) => {
    app.get('/admin/telemetry', (c) => {
      if (!adminToken) return c.notFound();
      const given = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1] ?? '';
      if (!timingSafeEqual(digest(given), digest(adminToken))) return c.json({ error: 'unauthorized' }, 401);
      return c.json({ rows: store.readTelemetry(c.req.query('since') ?? new Date(0).toISOString()) });
    });
  };
}
