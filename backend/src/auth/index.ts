import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { AUTH_BASE_PATH } from '@tabletop/contracts';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { bearer, deviceAuthorization, emailOTP, oneTimeToken } from 'better-auth/plugins';
import type { Hono } from 'hono';
import { mountBookRoutes, openBookStore, type BookStore } from './book.ts';
import { codeSender, type SendCode } from './email.ts';

/** The one client allowed to ask for a device code: the headset's page. */
export const DEVICE_CLIENT_ID = 'tabletop-headset';
const DAY_S = 24 * 60 * 60;

export interface AuthSettings {
  secret: string;
  /** The API's own public address, without a path. Google's redirect URI is `${baseURL}/v1/auth/callback/google`. */
  baseURL: string;
  /** The client's exact origins. The first is where the phone's link page lives. */
  clientOrigins: string[];
  google: { clientId: string; clientSecret: string } | null;
  sendCode: SendCode;
}

/** Reads the environment. Production needs a secret and its own URL; dev makes up what it can. */
export function readAuthSettings(
  env: Record<string, string | undefined>,
  { dev, backendPort, clientOrigins, log }: { dev: boolean; backendPort: number | null; clientOrigins: string[]; log: (message: string) => void },
): AuthSettings {
  const secret = env.BETTER_AUTH_SECRET ?? (dev ? randomBytes(32).toString('hex') : undefined);
  if (!secret) throw new Error('production needs BETTER_AUTH_SECRET');
  const baseURL = env.BETTER_AUTH_URL ?? (dev && backendPort ? `http://127.0.0.1:${backendPort}` : undefined);
  if (!baseURL) throw new Error('production needs BETTER_AUTH_URL, the API\'s public address');
  if (clientOrigins.length === 0) throw new Error('production needs TT_CLIENT_HOST');
  const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : null;
  if (!env.RESEND_API_KEY) log(dev ? 'auth: no RESEND_API_KEY, so email codes are printed here' : 'auth: no RESEND_API_KEY, so email sign-in is off');
  const sendCode = codeSender({
    resendKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM ?? 'Tabletop Theater <onboarding@resend.dev>',
    dev,
    log,
  });
  return { secret, baseURL: baseURL.replace(/\/+$/, ''), clientOrigins, google, sendCode };
}

function createAuth(db: DatabaseSync, settings: AuthSettings, books: BookStore) {
  return betterAuth({
    appName: 'Tabletop Theater',
    secret: settings.secret,
    baseURL: settings.baseURL,
    basePath: AUTH_BASE_PATH,
    database: db,
    trustedOrigins: settings.clientOrigins,
    session: { expiresIn: 30 * DAY_S, updateAge: DAY_S, freshAge: DAY_S },
    user: {
      deleteUser: {
        enabled: true,
        // Better Auth removes the user, sessions and accounts; the book, links and codes are ours.
        afterDelete: async (user) => {
          books.forget(user.id);
          db.prepare('DELETE FROM deviceCode WHERE userId = ?').run(user.id);
        },
      },
    },
    socialProviders: settings.google ? { google: { ...settings.google, prompt: 'select_account' } } : {},
    advanced: { ipAddress: { ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'] } },
    plugins: [
      deviceAuthorization({
        expiresIn: '10m',
        interval: '5s',
        verificationUri: `${settings.clientOrigins[0]}/link/`,
        validateClient: (clientId) => clientId === DEVICE_CLIENT_ID,
      }),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type === 'sign-in') await settings.sendCode(email, otp);
        },
      }),
      bearer(),
      // Minted only by `/v1/auth/google/done`, never by a client.
      oneTimeToken({ expiresIn: 3, disableClientRequest: true }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export interface Accounts {
  auth: Auth;
  /** The user a session token belongs to, or null. The guard's only way to decide someone is signed in. */
  sessionUser(token: string): Promise<string | null>;
  /** Better Auth and the Google trip, under `/v1/auth/*`. Before the contract check. */
  mountAuth(app: Hono): void;
  /** `/v1/me/*`. Behind the contract and device checks. */
  mountRoutes(app: Hono): void;
}

/** Better Auth on the store's own connection, with its tables migrated before the server listens. */
export async function openAccounts(db: DatabaseSync, settings: AuthSettings, now: () => Date = () => new Date()): Promise<Accounts> {
  const books = openBookStore(db);
  const auth = createAuth(db, settings, books);
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();

  const sessionUser = async (token: string): Promise<string | null> => {
    try {
      const session = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
      return session?.user.id ?? null;
    } catch {
      return null;
    }
  };

  /** A `return` address on the client's own origin, or null. */
  const clientReturn = (value: string | undefined): URL | null => {
    if (!value) return null;
    try {
      const url = new URL(value);
      return settings.clientOrigins.includes(url.origin) ? url : null;
    } catch {
      return null;
    }
  };

  /** The session cookie is only a step on the API's own origin: the client gets its token from the one-time code. */
  const clearedCookies = async (): Promise<string[]> => {
    const { authCookies } = await auth.$context;
    return [authCookies.sessionToken, authCookies.sessionData, authCookies.dontRememberToken].map(
      ({ name, attributes }) => `${name}=; Max-Age=0; Path=${attributes.path ?? '/'}; HttpOnly; SameSite=Lax${attributes.secure ? '; Secure' : ''}`,
    );
  };

  return {
    auth,
    sessionUser,

    mountAuth(app) {
      /** The client's `auth/return/` page, which trades `ott` for the session, or shows `error`, then goes on to `return`. */
      const backTo = (back: URL, outcome: { ott: string } | { error: 'google' }, cookies: string[] = []): Response => {
        const page = new URL('/auth/return/', back.origin);
        if ('ott' in outcome) page.searchParams.set('ott', outcome.ott);
        else page.searchParams.set('error', outcome.error);
        page.searchParams.set('return', back.href);
        const response = new Response(null, { status: 302, headers: { location: page.href, 'cache-control': 'no-store' } });
        for (const cookie of cookies) response.headers.append('set-cookie', cookie);
        return response;
      };

      // Google starts and ends here by top-level navigation, so its state cookie stays on one site.
      app.get(`${AUTH_BASE_PATH}/google/start`, async (c) => {
        const back = clientReturn(c.req.query('return'));
        if (!back) return c.text('return must be a page on the client', 400);
        if (!settings.google) return backTo(back, { error: 'google' });
        const done = `${settings.baseURL}${AUTH_BASE_PATH}/google/done?return=${encodeURIComponent(back.href)}`;
        const started = await auth.api
          .signInSocial({
            body: { provider: 'google', callbackURL: done, errorCallbackURL: `${done}&failed=1`, disableRedirect: true },
            headers: c.req.raw.headers,
            returnHeaders: true,
          })
          .catch(() => null);
        if (!started?.response.url) return backTo(back, { error: 'google' });
        const redirect = new Response(null, { status: 302, headers: { location: started.response.url, 'cache-control': 'no-store' } });
        for (const cookie of started.headers.getSetCookie()) redirect.headers.append('set-cookie', cookie);
        return redirect;
      });

      app.get(`${AUTH_BASE_PATH}/google/done`, async (c) => {
        const back = clientReturn(c.req.query('return'));
        if (!back) return c.text('return must be a page on the client', 400);
        const failed = Boolean(c.req.query('failed') || c.req.query('error'));
        const session = failed ? null : await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null);
        const minted = session ? await auth.api.generateOneTimeToken({ headers: c.req.raw.headers }).catch(() => null) : null;
        return backTo(back, minted ? { ott: minted.token } : { error: 'google' }, await clearedCookies());
      });

      app.on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, (c) => auth.handler(c.req.raw));
    },

    mountRoutes(app) {
      mountBookRoutes(app, books, now);
    },
  };
}
