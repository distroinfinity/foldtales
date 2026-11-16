import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * The sign-in round trip on the headset's page (lane A's audit, Nov 17): a sign-in from the
 * Storyteller's door comes back to that door, with the Storyteller as the page's destination; a
 * Google return without a session goes back to the page that started it and says why; the phone's
 * page goes back to its sign-in step, keeping the headset's code; and the bookplate learns whether
 * Google is switched on before offering it.
 */

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

let session: MemoryStorage;
let local: MemoryStorage;
let methods: unknown;

beforeEach(() => {
  session = new MemoryStorage();
  local = new MemoryStorage();
  methods = { google: true, email: true };
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/v1/auth/methods')) return methods === null ? Promise.reject(new Error('offline')) : new Response(JSON.stringify(methods), { status: 200 });
      return new Response('{}', { status: 404 });
    }),
  );
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ui = () => import('../client/src/landing/account-ui.ts');
const entry = () => import('../client/src/landing/entry.ts');

describe('from the door and back', () => {
  test('signed in from the Storyteller’s door: the page comes back to that door, and nothing is chosen for the reader', async () => {
    const { signInFor, signedIn, takeSignInReturn } = await ui();
    signInFor('storyteller', 1840);
    signedIn();
    // The door is on the page it comes back to; the chapters' card still speaks for the chapters.
    expect((await entry()).pendingEntry()).toBeNull();
    expect(takeSignInReturn()).toEqual({ for: 'storyteller', y: 1840, problem: null });
    // Once.
    expect(takeSignInReturn()).toBeNull();
  });

  test('signed in from the bookplate: no destination is chosen for the reader', async () => {
    const { signInFor, signedIn, takeSignInReturn } = await ui();
    signInFor('storyteller', 900);
    // The header's "Sign in" after the door's: the later one is what it was for.
    signInFor(null, 0);
    signedIn();
    expect((await entry()).pendingEntry()).toBeNull();
    expect(takeSignInReturn()).toEqual({ for: null, y: 0, problem: null });
  });

  test('a cancelled Google sign-in from the door comes back to the door, saying so, with nothing chosen', async () => {
    const { signInFor, signInFailed, takeSignInReturn } = await ui();
    signInFor('storyteller', 1840);
    signInFailed('google-cancelled');
    expect((await entry()).pendingEntry()).toBeNull();
    expect(takeSignInReturn()).toEqual({ for: 'storyteller', y: 1840, problem: expect.stringContaining('didn’t finish signing in with Google') });
  });

  test('each problem has its own words; an unknown one reads as a failure', async () => {
    const { signInProblemText } = await ui();
    expect(signInProblemText('google')).toMatch(/Google didn’t finish/);
    expect(signInProblemText('google-off')).toMatch(/isn’t available/);
    expect(signInProblemText('something-else')).toBe(signInProblemText('google'));
    expect(signInProblemText(null)).toBeNull();
    // On the phone's page, the other way in is an email code, not the phone.
    expect(signInProblemText('google-cancelled', 'phone')).toMatch(/get a code by email/);
  });

  test('a started sign-in is forgotten after half an hour', async () => {
    const { signInFor, signedIn, takeSignInReturn } = await ui();
    vi.useFakeTimers({ now: Date.parse('2026-11-17T20:00:00Z') });
    try {
      signInFor('storyteller', 0);
      vi.setSystemTime(Date.parse('2026-11-17T20:31:00Z'));
      signedIn();
      expect((await entry()).pendingEntry()).toBeNull();
      expect(takeSignInReturn()?.for).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('where Google’s return goes', () => {
  const HERE = 'https://www.foldtales.xyz/auth/return/';
  const HOME = 'https://www.foldtales.xyz/';

  test('the page that asked, if it’s on this site; else home', async () => {
    const { returnTarget } = await ui();
    expect(returnTarget('https://www.foldtales.xyz/link/?user_code=KXTR-49QM&step=approve', HERE, HOME).href).toBe('https://www.foldtales.xyz/link/?user_code=KXTR-49QM&step=approve');
    expect(returnTarget('https://evil.example/', HERE, HOME).href).toBe(HOME);
    expect(returnTarget(null, HERE, HOME).href).toBe(HOME);
  });

  test('without a session, the phone’s page goes back to its sign-in step with the code and the problem', async () => {
    const { failedTarget } = await ui();
    const to = new URL(failedTarget(new URL('https://www.foldtales.xyz/link/?user_code=KXTR-49QM&step=approve'), 'google-cancelled'));
    expect(to.pathname).toBe('/link/');
    expect(to.searchParams.get('user_code')).toBe('KXTR-49QM');
    expect(to.searchParams.get('step')).toBe('sign-in');
    expect(to.searchParams.get('problem')).toBe('google-cancelled');
  });

  test('without a session, the headset’s page is left as it was (the problem travels in this tab)', async () => {
    const { failedTarget } = await ui();
    expect(failedTarget(new URL(HOME), 'google')).toBe(HOME);
  });
});

describe('which ways in are offered', () => {
  test('the backend’s answer, asked once', async () => {
    const { availableSignIn } = await ui();
    methods = { google: false, email: true };
    expect(await availableSignIn()).toEqual({ google: false, email: true });
    await availableSignIn();
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => String(u).endsWith('/v1/auth/methods'))).toHaveLength(1);
  });

  test('offline, it can’t say (null), and asks again next time', async () => {
    const { availableSignIn } = await ui();
    methods = null;
    expect(await availableSignIn()).toBeNull();
    methods = { google: true, email: false };
    expect(await availableSignIn()).toEqual({ google: true, email: false });
  });
});

describe('Google’s return is redeemed only by the tab that started it (Codex review of #52, P1)', () => {
  const account = () => import('../client/src/account/index.ts');

  test('a return this tab never started asks nothing and signs nothing in', async () => {
    const { finishGoogleReturn } = await account();
    expect(await finishGoogleReturn('a-one-time-code-from-someone-else')).toBe(false);
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/google/finish') || String(u).includes('one-time-token'))).toBe(false);
    expect(local.getItem('tt.session')).toBeNull();
  });

  test('the start sends only the hash of the tab’s nonce, and the return redeems with the nonce, once', async () => {
    const { startGoogleSignIn, finishGoogleReturn } = await account();
    let went = '';
    await startGoogleSignIn('https://www.foldtales.xyz/', (url) => (went = url));
    const nonce = session.getItem('tt.google-nonce')!;
    expect(nonce.length).toBeGreaterThanOrEqual(43);
    const sent = new URL(went, 'https://api.foldtales.xyz').searchParams.get('nonce');
    const { createHash } = await import('node:crypto');
    expect(sent).toBe(createHash('sha256').update(nonce).digest('base64url'));
    expect(went).not.toContain(nonce);

    vi.mocked(fetch).mockImplementationOnce(async () => new Response(JSON.stringify({ session: { token: 'session-token' }, user: { id: 'u1', name: 'Ann', email: 'ann@example.com' } }), { status: 200 }));
    expect(await finishGoogleReturn('the-code')).toBe(true);
    const [url, init] = vi.mocked(fetch).mock.calls.at(-1)!;
    expect(String(url)).toMatch(/\/v1\/auth\/google\/finish$/);
    expect(JSON.parse(String(init?.body))).toEqual({ ott: 'the-code', nonce });
    // Spent: a second return in this tab has nothing to redeem with.
    expect(session.getItem('tt.google-nonce')).toBeNull();
    expect(await finishGoogleReturn('the-code')).toBe(false);
  });
});
