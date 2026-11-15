import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { describe, expect, test } from 'vitest';
import { openAccounts, type AuthSettings } from '../src/auth/index.ts';
import { WELCOME_MARK, firstNameOf, renderWelcome, type SendWelcome, type WelcomeEmail } from '../src/auth/welcome.ts';

const API = 'https://api.foldtales.xyz';
const SITE = 'https://www.foldtales.xyz';

async function accounts(sendWelcome: SendWelcome) {
  const codes: Array<{ email: string; code: string }> = [];
  const settings: AuthSettings = {
    secret: 'a-test-secret-that-is-long-enough-for-better-auth-0123456789',
    baseURL: API,
    clientOrigins: [SITE],
    google: null,
    sendCode: async (email, code) => void codes.push({ email, code }),
    sendWelcome,
  };
  const acc = await openAccounts(new DatabaseSync(':memory:'), settings);
  const app = new Hono();
  acc.mountAuth(app);
  const call = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(`${API}${path}`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const signIn = async (email: string): Promise<{ status: number; ms: number; token: string | null }> => {
    await call('/v1/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
    const code = codes.filter((c) => c.email === email).at(-1)!.code;
    const t0 = Date.now();
    const answer = await call('/v1/auth/sign-in/email-otp', { email, otp: code });
    return { status: answer.status, ms: Date.now() - t0, token: answer.headers.get('set-auth-token') };
  };
  return { acc, signIn, call };
}

describe('the welcome email', () => {
  test('goes once per account, however many times they sign in', async () => {
    const sent: Array<{ to: string; email: WelcomeEmail }> = [];
    const { acc, signIn } = await accounts(async (to, email) => void sent.push({ to, email }));
    await signIn('reader@example.com');
    await signIn('reader@example.com');
    await Promise.all([signIn('reader@example.com'), signIn('reader@example.com')]);
    await acc.welcomer.settled();
    expect(sent.map((s) => s.to)).toEqual(['reader@example.com']);
    expect(sent[0]!.email.subject).toBe('Your book is ready');
    await signIn('another@example.com');
    await acc.welcomer.settled();
    expect(sent.map((s) => s.to)).toEqual(['reader@example.com', 'another@example.com']);
  });

  test('never holds up sign-in, even when the email never finishes', async () => {
    const { signIn } = await accounts(() => new Promise(() => {}));
    const answer = await signIn('slow@example.com');
    expect(answer.status).toBe(200);
    expect(answer.token).toBeTruthy();
    expect(answer.ms).toBeLessThan(2000);
  });

  test('a failure is only logged, sign-in still works, and the next sign-in tries again', async () => {
    let fail = true;
    const sent: string[] = [];
    const { acc, signIn } = await accounts(async (to) => {
      if (fail) throw new Error('Resend answered 500');
      sent.push(to);
    });
    expect((await signIn('flaky@example.com')).status).toBe(200);
    await acc.welcomer.settled();
    expect(sent).toEqual([]);
    fail = false;
    await signIn('flaky@example.com');
    await acc.welcomer.settled();
    expect(sent).toEqual(['flaky@example.com']);
  });

  test('deleting the account removes its record', async () => {
    const sent: string[] = [];
    const { acc, signIn, call } = await accounts(async (to) => void sent.push(to));
    const { token } = await signIn('gone@example.com');
    await acc.welcomer.settled();
    expect((await call('/v1/auth/delete-user', {}, { authorization: `Bearer ${token}` })).status).toBe(200);
    expect(sent).toEqual(['gone@example.com']);
  });
});

describe('what it says', () => {
  test('the name only when the provider gave a real one', () => {
    expect(firstNameOf('Sam Rivera', 'sam@example.com')).toBe('Sam');
    expect(firstNameOf('', 'sam@example.com')).toBeNull();
    expect(firstNameOf('sam@example.com', 'sam@example.com')).toBeNull();
    expect(firstNameOf(null, 'sam@example.com')).toBeNull();
    expect(renderWelcome({ name: 'Sam' }).html).toContain('Hi Sam,');
    expect(renderWelcome({ name: null }).text).toContain('Hello,');
  });

  test('HTML and plain text; one image, the mark, from the site; no tracking; no reply invited', () => {
    const { html, text } = renderWelcome({ name: null });
    const images = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(images)).toEqual(new Set([WELCOME_MARK]));
    expect(WELCOME_MARK.startsWith('https://www.foldtales.xyz/')).toBe(true);
    expect(html).not.toMatch(/width="1"|height="1"|pixel|track/i);
    for (const part of [html, text]) {
      expect(part).not.toMatch(/\breply\b/i);
      expect(part).toContain('Manu');
      expect(part).toContain('foldtales.xyz');
    }
    expect(text).not.toMatch(/<[a-z]/i);
    // Escaped: a name can't inject markup.
    expect(renderWelcome({ name: '<b>x</b>' }).html).not.toContain('<b>x</b>');
  });
});
