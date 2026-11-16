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

async function accounts() {
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
  const acc = await openAccounts(db, settings, () => new Date(), (id) => forgotten.push(id));
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
  return { acc, call, signIn, forgotten };
}

describe('Google', () => {
  test('starts at Google with exactly the registered redirect, and keeps where to come back to', async () => {
    const { call } = await accounts();
    const back = `${SITE}/?go=storyteller`;
    const answer = await call(`/v1/auth/google/start?return=${encodeURIComponent(back)}`);
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
    expect((await call(`/v1/auth/google/start?return=${encodeURIComponent('https://evil.example/')}`)).status).toBe(400);
  });

  test('coming back without a session (cancelled, or an error) goes to the return page with the door kept', async () => {
    const { call } = await accounts();
    const back = `${SITE}/?go=storyteller`;
    for (const [tail, error] of [['', 'google'], ['&failed=1', 'google'], ['&failed=1&error=access_denied', 'google-cancelled'], ['&error=server_error', 'google']]) {
      const answer = await call(`/v1/auth/google/done?return=${encodeURIComponent(back)}${tail}`);
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
    const answer = await app.request(`${API}/v1/auth/google/start?return=${encodeURIComponent(`${SITE}/`)}`);
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
