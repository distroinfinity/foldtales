import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { DEVICE_CLIENT_ID, openAccounts, type AuthSettings } from '../src/auth/index.ts';

/**
 * Sign-in on the real accounts layer (Better Auth), with no network: Google's start and return,
 * and the phone code from start to a signed-in headset. Stage 2, ruling 9. Google's own token
 * exchange can't run here; what it starts and where it comes back are checked exactly.
 */

const API = 'https://api.foldtales.xyz';
const SITE = 'https://www.foldtales.xyz';

/** What the starting tab keeps, and the hash it sends to /google/start. */
const NONCE = 'the-tab-kept-this-nonce-0123456789abcdef';
const hashOf = (nonce: string) => createHash('sha256').update(nonce).digest('base64url');

async function accounts(clock: () => Date = () => new Date()) {
  const codes: Array<{ email: string; code: string }> = [];
  const settings: AuthSettings = {
    secret: 'a-test-secret-that-is-long-enough-for-better-auth-0123456789',
    baseURL: API,
    clientOrigins: [SITE],
    google: { clientId: 'test-client.apps.googleusercontent.com', clientSecret: 'test-secret' },
    sendCode: async (email, code) => void codes.push({ email, code }),
  };
  const db = new DatabaseSync(':memory:');
  const forgotten: string[] = [];
  const acc = await openAccounts(db, settings, clock, (id) => forgotten.push(id));
  const app = new Hono();
  acc.mountAuth(app);
  const call = (path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
    app.request(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: { origin: SITE, ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  /** Signs in with an emailed code, as the phone does, and returns the session token. */
  const signIn = async (email: string): Promise<string> => {
    await call('/v1/auth/email-otp/send-verification-otp', { method: 'POST', body: { email, type: 'sign-in' } });
    const code = codes.filter((c) => c.email === email).at(-1)!.code;
    const answer = await call('/v1/auth/sign-in/email-otp', { method: 'POST', body: { email, otp: code } });
    expect(answer.status).toBe(200);
    return answer.headers.get('set-auth-token') ?? ((await answer.json()) as { token: string }).token;
  };
  /** The same, as a browser: the session cookie Better Auth sets on the API's origin (as Google's callback does). */
  const signInCookie = async (email: string): Promise<string> => {
    await call('/v1/auth/email-otp/send-verification-otp', { method: 'POST', body: { email, type: 'sign-in' } });
    const code = codes.filter((c) => c.email === email).at(-1)!.code;
    const answer = await call('/v1/auth/sign-in/email-otp', { method: 'POST', body: { email, otp: code } });
    return answer.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  };
  /** Starts a Google trip from a tab holding `nonce`, and returns the trip's id (kept in Google's state). */
  const startTrip = async (nonce = NONCE, back = `${SITE}/`): Promise<string> => {
    const answer = await call(`/v1/auth/google/start?return=${encodeURIComponent(back)}&nonce=${hashOf(nonce)}`);
    expect(answer.status).toBe(302);
    return (db.prepare('SELECT id FROM google_trip ORDER BY started_at DESC, rowid DESC LIMIT 1').get() as { id: string }).id;
  };
  const ottFrom = (answer: Response) => new URL(answer.headers.get('location')!).searchParams.get('ott');
  return { acc, db, call, signIn, signInCookie, startTrip, ottFrom, forgotten };
}

describe('Google', () => {
  test('starts at Google with exactly the registered redirect, and keeps where to come back to', async () => {
    const { call } = await accounts();
    const back = `${SITE}/?go=storyteller`;
    const answer = await call(`/v1/auth/google/start?return=${encodeURIComponent(back)}&nonce=${hashOf(NONCE)}`);
    expect(answer.status).toBe(302);
    const to = new URL(answer.headers.get('location')!);
    expect(to.host).toBe('accounts.google.com');
    expect(to.searchParams.get('redirect_uri')).toBe(`${API}/v1/auth/callback/google`);
    expect(to.searchParams.get('client_id')).toBe('test-client.apps.googleusercontent.com');
    expect(to.searchParams.get('scope')?.split(' ')).toEqual(expect.arrayContaining(['openid', 'email', 'profile']));
    // Google's state cookie stays on the API's own address.
    expect(answer.headers.getSetCookie().length).toBeGreaterThan(0);
  });

  test('a return address off the site is refused', async () => {
    const { call } = await accounts();
    expect((await call(`/v1/auth/google/start?return=${encodeURIComponent('https://evil.example/')}&nonce=${hashOf(NONCE)}`)).status).toBe(400);
  });

  test('a start without the tab’s nonce hash is refused', async () => {
    const { call } = await accounts();
    expect((await call(`/v1/auth/google/start?return=${encodeURIComponent(`${SITE}/`)}`)).status).toBe(400);
    expect((await call(`/v1/auth/google/start?return=${encodeURIComponent(`${SITE}/`)}&nonce=short`)).status).toBe(400);
  });

  test('coming back without a session (cancelled, or an error) goes to the trip’s own return page, saying which', async () => {
    const { call, startTrip } = await accounts();
    const back = `${SITE}/?go=storyteller`;
    for (const [tail, error] of [['', 'google'], ['&failed=1', 'google'], ['&failed=1&error=access_denied', 'google-cancelled'], ['&error=server_error', 'google']]) {
      const trip = await startTrip(NONCE, back);
      // A `return` in the address is ignored: the trip keeps where it came from.
      const answer = await call(`/v1/auth/google/done?trip=${trip}&return=${encodeURIComponent(`${SITE}/elsewhere`)}${tail}`);
      expect(answer.status).toBe(302);
      const to = new URL(answer.headers.get('location')!);
      expect(`${to.origin}${to.pathname}`).toBe(`${SITE}/auth/return/`);
      expect(to.searchParams.get('error')).toBe(error);
      expect(to.searchParams.get('return')).toBe(back);
    }
  });

  test('with Google not set up, the start still lands on the return page, never a dead end', async () => {
    const codes: string[] = [];
    const acc = await openAccounts(new DatabaseSync(':memory:'), { secret: 'a-test-secret-that-is-long-enough-for-better-auth-0123456789', baseURL: API, clientOrigins: [SITE], google: null, sendCode: async (_e, c) => void codes.push(c) });
    const app = new Hono();
    acc.mountAuth(app);
    const answer = await app.request(`${API}/v1/auth/google/start?return=${encodeURIComponent(`${SITE}/`)}&nonce=${hashOf(NONCE)}`);
    expect(new URL(answer.headers.get('location')!).searchParams.get('error')).toBe('google-off');
    // And the page can tell beforehand, so it never offers the button.
    expect(await (await app.request(`${API}/v1/auth/methods`)).json()).toEqual({ google: false, email: true });
  });

  test('the ways in that are switched on', async () => {
    const { call } = await accounts();
    expect(await (await call('/v1/auth/methods')).json()).toEqual({ google: true, email: true });
    const off = await openAccounts(new DatabaseSync(':memory:'), { secret: 'a-test-secret-that-is-long-enough-for-better-auth-0123456789', baseURL: API, clientOrigins: [SITE], google: null, email: false, sendCode: async () => undefined });
    const app = new Hono();
    off.mountAuth(app);
    expect(await (await app.request(`${API}/v1/auth/methods`)).json()).toEqual({ google: false, email: false });
  });
});

describe('the Google handoff is bound to the tab that started it (Codex review of #52, P1)', () => {
  test('a forged return mints nothing: an attacker’s own session, with no trip, gets no one-time code', async () => {
    const { call, signIn, signInCookie, ottFrom } = await accounts();
    const bearer = await signIn('attacker@example.com');
    const cookie = await signInCookie('attacker@example.com');
    const forged = await call(`/v1/auth/google/done?return=${encodeURIComponent(`${SITE}/`)}`, { headers: { authorization: `Bearer ${bearer}`, cookie } });
    expect(ottFrom(forged)).toBeNull();
    expect(new URL(forged.headers.get('location')!).searchParams.get('error')).toBe('google');
  });

  test('a real trip completes only with the session cookie made after it started, never a bearer token', async () => {
    const { call, signIn, signInCookie, startTrip, ottFrom } = await accounts();
    const old = await signInCookie('reader@example.com');
    // A session from before the trip began isn't this trip's sign-in.
    expect(ottFrom(await call(`/v1/auth/google/done?trip=${await startTrip()}`, { headers: { cookie: old } }))).toBeNull();
    // A bearer token isn't a browser finishing Google's callback.
    const bearer = await signIn('attacker@example.com');
    expect(ottFrom(await call(`/v1/auth/google/done?trip=${await startTrip()}`, { headers: { authorization: `Bearer ${bearer}` } }))).toBeNull();
  });

  test('the code is redeemed once, and only with the nonce of the tab that started the trip', async () => {
    const { call, signInCookie, startTrip, ottFrom } = await accounts();
    const finish = (ott: string, nonce: string) => call('/v1/auth/google/finish', { method: 'POST', body: { ott, nonce } });

    // Another tab (or another browser handed the link) holds a different nonce, or none: refused, and the code is spent.
    let trip = await startTrip();
    let ott = ottFrom(await call(`/v1/auth/google/done?trip=${trip}`, { headers: { cookie: await signInCookie('attacker@example.com') } }))!;
    expect(ott).toBeTruthy();
    expect((await finish(ott, 'a-different-tab-nonce-0123456789abcdef')).status).toBe(403);
    expect((await finish(ott, NONCE)).status).toBe(403);

    // The tab that started it: signed in, once.
    trip = await startTrip();
    ott = ottFrom(await call(`/v1/auth/google/done?trip=${trip}`, { headers: { cookie: await signInCookie('reader@example.com') } }))!;
    const answer = await finish(ott, NONCE);
    expect(answer.status).toBe(200);
    const body = (await answer.json()) as { session: { token: string }; user: { email: string } };
    expect(body.user.email).toBe('reader@example.com');
    expect(body.session.token).toBeTruthy();
    expect((await finish(ott, NONCE)).status).toBe(403);

    // A trip completes once: replaying Google's callback mints nothing more.
    expect(ottFrom(await call(`/v1/auth/google/done?trip=${trip}`, { headers: { cookie: await signInCookie('reader@example.com') } }))).toBeNull();
  });

  test('Better Auth’s own one-time-token route is closed, so the nonce can’t be skipped', async () => {
    const { call, signInCookie, startTrip, ottFrom } = await accounts();
    const ott = ottFrom(await call(`/v1/auth/google/done?trip=${await startTrip()}`, { headers: { cookie: await signInCookie('reader@example.com') } }))!;
    expect((await call('/v1/auth/one-time-token/verify', { method: 'POST', body: { token: ott } })).status).toBe(404);
  });

  test('a trip left longer than ten minutes completes nothing', async () => {
    let at = Date.parse('2026-11-17T10:00:00Z');
    const { call, signInCookie, startTrip, ottFrom } = await accounts(() => new Date(at));
    const trip = await startTrip();
    at += 11 * 60_000;
    expect(ottFrom(await call(`/v1/auth/google/done?trip=${trip}`, { headers: { cookie: await signInCookie('reader@example.com') } }))).toBeNull();
  });
});

describe('the phone code', () => {
  const poll = (call: Awaited<ReturnType<typeof accounts>>['call'], deviceCode: string) =>
    call('/v1/auth/device/token', { method: 'POST', body: { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: deviceCode, client_id: DEVICE_CLIENT_ID } });

  test('the headset shows a code; the phone signs in and approves it; the headset gets its session', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() });
    onTestFinished(() => void vi.useRealTimers());
    const { acc, call, signIn } = await accounts();
    const started = (await (await call('/v1/auth/device/code', { method: 'POST', body: { client_id: DEVICE_CLIENT_ID } })).json()) as { device_code: string; user_code: string; verification_uri: string };
    expect(started.verification_uri).toBe(`${SITE}/link/`);
    expect((await poll(call, started.device_code)).status).toBe(400);

    const phone = await signIn('reader@example.com');
    const claim = await call(`/v1/auth/device?user_code=${started.user_code}`, { headers: { authorization: `Bearer ${phone}` } });
    expect(claim.status).toBe(200);
    expect((await call('/v1/auth/device/approve', { method: 'POST', body: { userCode: started.user_code }, headers: { authorization: `Bearer ${phone}` } })).status).toBe(200);

    // The headset polls no faster than every 5 s (slow_down otherwise).
    vi.setSystemTime(Date.now() + 6000);
    const done = await poll(call, started.device_code);
    expect(done.status).toBe(200);
    const { access_token } = (await done.json()) as { access_token: string };
    // The headset's token is a real session for the same reader: what the guard checks.
    const headset = await acc.sessionUser(access_token);
    expect(headset).not.toBeNull();
    expect(headset).toBe(await acc.sessionUser(phone));
  });

  test('declined on the phone, the headset hears so', async () => {
    const { call, signIn } = await accounts();
    const started = (await (await call('/v1/auth/device/code', { method: 'POST', body: { client_id: DEVICE_CLIENT_ID } })).json()) as { device_code: string; user_code: string };
    const phone = await signIn('reader@example.com');
    await call(`/v1/auth/device?user_code=${started.user_code}`, { headers: { authorization: `Bearer ${phone}` } });
    await call('/v1/auth/device/deny', { method: 'POST', body: { userCode: started.user_code }, headers: { authorization: `Bearer ${phone}` } });
    const answer = await poll(call, started.device_code);
    expect(((await answer.json()) as { error: string }).error).toBe('access_denied');
  });

  test('only the headset may ask for a code', async () => {
    const { call } = await accounts();
    expect((await call('/v1/auth/device/code', { method: 'POST', body: { client_id: 'someone-else' } })).status).toBeGreaterThanOrEqual(400);
  });
});

test('deleting the account tells the other stores to forget the reader', async () => {
  const { call, signIn, forgotten, acc } = await accounts();
  const token = await signIn('gone@example.com');
  const userId = await acc.sessionUser(token);
  const answer = await call('/v1/auth/delete-user', { method: 'POST', body: {}, headers: { authorization: `Bearer ${token}` } });
  expect(answer.status).toBe(200);
  expect(forgotten).toEqual([userId]);
});
