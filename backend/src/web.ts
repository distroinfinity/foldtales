import { createHash, timingSafeEqual } from 'node:crypto';
import { AUTH_BASE_PATH, BackendError, CONTRACT_HEADER, SESSION_HEADER } from '@tabletop/contracts';
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

/**
 * The client's exact origins: https on the client's host, plus the dev client's own addresses.
 * Credentialed CORS, Google's return and Better Auth's trusted origins use only these.
 */
export function clientOrigins(clientHost: string | undefined, devOrigins: string[] = []): string[] {
  return [...(clientHost ? [`https://${clientHost}`] : []), ...devOrigins];
}

/**
 * CORS for the client's host only. App routes are cookie-free; `/v1/auth/*` is credentialed,
 * for the exact client origin. Runs before every other check, since a preflight carries no headers.
 */
export function browserAccess(clientHost: string | undefined, devOrigins: string[] = []): MiddlewareHandler[] {
  const exact = clientOrigins(clientHost, devOrigins);
  const shared = {
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['content-type', 'authorization', CONTRACT_HEADER, SESSION_HEADER],
    exposeHeaders: ['set-auth-token'],
    maxAge: 600,
  };
  // Branch previews (e.g. <branch>.foldtales.pages.dev) reach the app routes too; never the credentialed auth routes.
  const previewHost = process.env.TT_PREVIEW_HOST;
  const appCors = cors({
    ...shared,
    origin: (origin) => (isAllowedOrigin(origin, clientHost) || isAllowedOrigin(origin, previewHost) || exact.includes(origin) ? origin : null),
  });
  const authCors = cors({ ...shared, credentials: true, origin: (origin) => (exact.includes(origin) ? origin : null) });
  return [
    (c, next) => (c.req.path.startsWith(`${AUTH_BASE_PATH}/`) ? authCors(c, next) : appCors(c, next)),
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
