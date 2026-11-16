import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { AUTH_BASE_PATH } from '@tabletop/contracts';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { bearer, deviceAuthorization, emailOTP, oneTimeToken } from 'better-auth/plugins';
import type { Hono } from 'hono';
import { mountBookRoutes, openBookStore, type BookStore } from './book.ts';
import { codeSender, type SendCode } from './email.ts';
import { createWelcomer, resendWelcome, type SendWelcome, type Welcomer } from './welcome.ts';

/** How long a Google trip may take, start to return (Google's own state lasts as long). */
const GOOGLE_TRIP_MS = 10 * 60_000;
/** How long the one-time code from Google's return lasts (Better Auth's oneTimeToken, 3 minutes). */
const GOOGLE_OTT_MS = 3 * 60_000;
/** A SHA-256 in base64url: what the starting tab sends instead of its nonce. */
const NONCE_HASH = /^[A-Za-z0-9_-]{43}$/;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('base64url');
const sameText = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

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
  /** Email codes can be sent (a Resend key, or dev printing them). Unset means yes. */
  email?: boolean;
  /** The welcome email's sender, or null when email is off (no RESEND_API_KEY). */
  sendWelcome?: SendWelcome | null;
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
    from: env.RESEND_FROM ?? 'Foldtales <onboarding@resend.dev>',
    dev,
    log,
  });
  const sendWelcome = env.RESEND_API_KEY
    ? resendWelcome({ resendKey: env.RESEND_API_KEY, from: env.RESEND_FROM ?? 'Foldtales <onboarding@resend.dev>', replyTo: env.WELCOME_REPLY_TO })
    : null;
  return { secret, baseURL: baseURL.replace(/\/+$/, ''), clientOrigins, google, sendCode, email: Boolean(env.RESEND_API_KEY) || dev, sendWelcome };
}

function createAuth(db: DatabaseSync, settings: AuthSettings, books: BookStore, forget: (userId: string) => void, welcomer: Welcomer) {
  return betterAuth({
    appName: 'Foldtales',
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
          welcomer.forget(user.id);
          forget(user.id);
          db.prepare('DELETE FROM deviceCode WHERE userId = ?').run(user.id);
        },
      },
    },
    socialProviders: settings.google ? { google: { ...settings.google, prompt: 'select_account' } } : {},
    advanced: { ipAddress: { ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'] } },
    // Every sign-in (Google, the email code, the phone's approval) makes a session: the welcome is
    // sent once per account from here, after the account exists, never on sign-in's own path.
    databaseHooks: { session: { create: { after: async (session) => welcomer.afterSignIn(session.userId) } } },
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
  /** The welcome email's sender (for tests: `settled()`). */
  welcomer: Welcomer;
  /** The user a session token belongs to, or null. The guard's only way to decide someone is signed in. */
  sessionUser(token: string): Promise<string | null>;
  /** Better Auth and the Google trip, under `/v1/auth/*`. Before the contract check. */
  mountAuth(app: Hono): void;
  /** `/v1/me/*`. Behind the contract and device checks. */
  mountRoutes(app: Hono): void;
}

/** Better Auth on the store's own connection, with its tables migrated before the server listens. */
/** `forget` removes what other stores keep for a deleted reader (the Storyteller's stories). */
export async function openAccounts(db: DatabaseSync, settings: AuthSettings, now: () => Date = () => new Date(), forget: (userId: string) => void = () => {}): Promise<Accounts> {
  const books = openBookStore(db);
  const welcomer = createWelcomer(db, settings.sendWelcome ?? null, (m) => console.log(m), now);
  const auth = createAuth(db, settings, books, forget, welcomer);
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

  /**
   * A Google sign-in in progress, bound to the browser tab that started it. The tab keeps a random
   * nonce and sends only its hash at the start; the one-time code minted on the return can only be
   * redeemed with the nonce itself, once. So a return this tab didn't start (a link someone else
   * made, or an OTT minted for another account) never signs it in (Codex review of #52, P1).
   */
  db.exec(`CREATE TABLE IF NOT EXISTS google_trip (
    id TEXT PRIMARY KEY,
    nonce_hash TEXT NOT NULL,
    return_to TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ott_hash TEXT,
    minted_at INTEGER,
    state TEXT NOT NULL DEFAULT 'started'
  )`);
  type Trip = { id: string; nonce_hash: string; return_to: string; started_at: number; ott_hash: string | null; minted_at: number | null; state: 'started' | 'minted' | 'ended' };
  const tripById = (id: string): Trip | null => (db.prepare('SELECT * FROM google_trip WHERE id = ?').get(id) as Trip | undefined) ?? null;
  const endTrip = (id: string): void => void db.prepare("UPDATE google_trip SET state = 'ended' WHERE id = ?").run(id);
  const sweepTrips = (): void => void db.prepare('DELETE FROM google_trip WHERE started_at < ?').run(now().getTime() - 24 * 60 * 60_000);

  /** The session cookie is only a step on the API's own origin: the client gets its token from the one-time code. */
  const clearedCookies = async (): Promise<string[]> => {
    const { authCookies } = await auth.$context;
    return [authCookies.sessionToken, authCookies.sessionData, authCookies.dontRememberToken].map(
      ({ name, attributes }) => `${name}=; Max-Age=0; Path=${attributes.path ?? '/'}; HttpOnly; SameSite=Lax${attributes.secure ? '; Secure' : ''}`,
    );
  };

  return {
    auth,
    welcomer,
    sessionUser,

    mountAuth(app) {
      /** The client's `auth/return/` page, which trades `ott` for the session, or shows `error`, then goes on to `return`. */
      const backTo = (back: URL, outcome: { ott: string } | { error: 'google' | 'google-cancelled' | 'google-off' }, cookies: string[] = []): Response => {
        const page = new URL('/auth/return/', back.origin);
        if ('ott' in outcome) page.searchParams.set('ott', outcome.ott);
        else page.searchParams.set('error', outcome.error);
        page.searchParams.set('return', back.href);
        const response = new Response(null, { status: 302, headers: { location: page.href, 'cache-control': 'no-store' } });
        for (const cookie of cookies) response.headers.append('set-cookie', cookie);
        return response;
      };

      // Which ways in are switched on, so the bookplate and the phone's page offer only those.
      app.get(`${AUTH_BASE_PATH}/methods`, (c) => {
        c.header('cache-control', 'no-store');
        return c.json({ google: settings.google !== null, email: settings.email ?? true });
      });

      // Google starts and ends here by top-level navigation, so its state cookie stays on one site.
      app.get(`${AUTH_BASE_PATH}/google/start`, async (c) => {
        const back = clientReturn(c.req.query('return'));
        if (!back) return c.text('return must be a page on the client', 400);
        // The starting tab's nonce, hashed: the only way this trip's code can be redeemed later.
        const nonceHash = c.req.query('nonce') ?? '';
        if (!NONCE_HASH.test(nonceHash)) return c.text('nonce must be the SHA-256 of the tab\'s nonce, in base64url', 400);
        if (!settings.google) return backTo(back, { error: 'google-off' });
        sweepTrips();
        const trip = randomBytes(24).toString('base64url');
        db.prepare('INSERT INTO google_trip (id, nonce_hash, return_to, started_at) VALUES (?, ?, ?, ?)').run(trip, nonceHash, back.href, now().getTime());
        // The trip rides inside Google's own state (Better Auth keeps the callback address in it).
        const done = `${settings.baseURL}${AUTH_BASE_PATH}/google/done?trip=${trip}`;
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

      /**
       * Google's callback ends here. It completes only a trip started here, within its time, once,
       * and only with the session cookie Google's callback just set on this origin (made after the
       * trip began). A bearer token, an old session or an unknown trip never mints a code.
       */
      app.get(`${AUTH_BASE_PATH}/google/done`, async (c) => {
        const trip = tripById(c.req.query('trip') ?? '');
        const fresh = trip !== null && trip.state === 'started' && now().getTime() - trip.started_at <= GOOGLE_TRIP_MS;
        const back = (trip && clientReturn(trip.return_to)) ?? new URL(`${settings.clientOrigins[0]}/`);
        if (!trip || !fresh) return backTo(back, { error: 'google' }, await clearedCookies());
        endTrip(trip.id);
        // The reader said no on Google's page (access_denied): the page says so, rather than "it failed".
        const error = c.req.query('error') === 'access_denied' ? 'google-cancelled' : 'google';
        if (c.req.query('failed') || c.req.query('error')) return backTo(back, { error }, await clearedCookies());
        const cookieOnly = new Headers();
        const cookie = c.req.header('cookie');
        if (cookie) cookieOnly.set('cookie', cookie);
        const session = await auth.api.getSession({ headers: cookieOnly }).catch(() => null);
        const madeAt = session ? new Date(session.session.createdAt).getTime() : 0;
        if (!session || madeAt < trip.started_at) return backTo(back, { error: 'google' }, await clearedCookies());
        const minted = await auth.api.generateOneTimeToken({ headers: cookieOnly }).catch(() => null);
        if (!minted) return backTo(back, { error: 'google' }, await clearedCookies());
        db.prepare("UPDATE google_trip SET ott_hash = ?, minted_at = ?, state = 'minted' WHERE id = ?").run(sha256(minted.token), now().getTime(), trip.id);
        return backTo(back, { ott: minted.token }, await clearedCookies());
      });

      /**
       * The return page trades the one-time code for the session here, with the nonce its tab kept.
       * Once: a wrong nonce ends the trip too. Better Auth's own verify route is closed (below).
       */
      app.post(`${AUTH_BASE_PATH}/google/finish`, async (c) => {
        const body = (await c.req.json().catch(() => null)) as { ott?: unknown; nonce?: unknown } | null;
        const ott = typeof body?.ott === 'string' ? body.ott : '';
        const nonce = typeof body?.nonce === 'string' ? body.nonce : '';
        const refused = () => c.json({ error: 'google_trip', message: 'this sign-in was not started here' }, 403);
        if (!ott || nonce.length < 32) return refused();
        const trip = db.prepare("SELECT * FROM google_trip WHERE ott_hash = ? AND state = 'minted'").get(sha256(ott)) as Trip | undefined;
        if (!trip) return refused();
        endTrip(trip.id);
        if (!sameText(sha256(nonce), trip.nonce_hash) || now().getTime() - (trip.minted_at ?? 0) > GOOGLE_OTT_MS) return refused();
        const verified = await auth.api.verifyOneTimeToken({ body: { token: ott } }).catch(() => null);
        if (!verified) return refused();
        c.header('cache-control', 'no-store');
        return c.json({ session: { token: verified.session.token }, user: { id: verified.user.id, name: verified.user.name, email: verified.user.email } });
      });

      // The one-time code is redeemed only through /google/finish, with the starting tab's nonce.
      app.post(`${AUTH_BASE_PATH}/one-time-token/verify`, (c) => c.json({ error: 'not_found' }, 404));

      app.on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, (c) => auth.handler(c.req.raw));
    },

    mountRoutes(app) {
      mountBookRoutes(app, books, now);
    },
  };
}
