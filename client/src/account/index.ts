import {
  AUTH_BASE_PATH,
  Book,
  CONTRACT_HEADER,
  CONTRACT_VERSION,
  SESSION_HEADER,
  accountRoutes,
  type BookPut,
} from '@tabletop/contracts';
import { SESSION_KEY, createBackendAccess, withDeadline, type BackendAccess } from '../backend.ts';
import { ACCOUNTS_ON } from '../landing/flags.ts';
import { forgetLocalChapters, readLocalChapters, writeLocalChapters } from '../show/progress.ts';
import { forgetReaderPending } from '../storyteller/pending.ts';
import { mergeBooks, sameBook, type LocalBook } from './merge.ts';

export { mergeBooks, type LocalBook } from './merge.ts';

/**
 * The account's data layer for the landing, the phone's link page and the Google return page.
 * No UI. Every function feature-detects and fails soft: nothing here throws into UI code.
 */

const USER_KEY = 'tt.session.user';
const LAPSED_KEY = 'tt.session.lapsed';
const PROGRESS_KEY = 'tt.progress';
const CHECKPOINT_KEY = 'tt.checkpoint';
const GENERATION_KEY = 'tt.generation';
/** Must match the backend's `DEVICE_CLIENT_ID`. */
const DEVICE_CLIENT_ID = 'tabletop-headset';
const EPOCH = new Date(0).toISOString();

export interface AccountUser {
  id: string;
  name: string;
  email: string;
}

export type DeviceSignInStatus = 'approved' | 'denied' | 'expired' | 'pending';
export type CodeCheck = 'pending' | 'approved' | 'denied' | 'invalid' | 'expired' | 'offline';
export type PhoneAnswer = 'ok' | 'invalid' | 'expired' | 'signed-out' | 'failed';
export type EmailVerify = 'ok' | 'wrong-code' | 'expired' | 'failed';

/** In dev, `/api` is proxied to this workspace's own backend; the same source `index.ts` uses. */
const BASE = (import.meta.env.TT_PUBLIC_BACKEND_URL ?? '/api').replace(/\/+$/, '');
const AUTH = `${BASE}${AUTH_BASE_PATH}`;

// ---- storage, never throwing -------------------------------------------------

const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Without storage, the sign-in lasts as long as the page.
    }
  },
  removeItem(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  },
};

const readJson = (key: string): unknown => {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' ? (value as Record<string, unknown>) : null);

const sessionToken = (): string | null => storage.getItem(SESSION_KEY);

const userFrom = (value: unknown): AccountUser | null => {
  const user = record(value);
  if (!user || typeof user.id !== 'string') return null;
  return { id: user.id, name: typeof user.name === 'string' ? user.name : '', email: typeof user.email === 'string' ? user.email : '' };
};

/** The reader's generation. Bumped on every sign-in, sign-out and delete, so a write started before the switch can tell. */
export function readGeneration(): number {
  const n = Number(storage.getItem(GENERATION_KEY));
  return Number.isFinite(n) ? n : 0;
}

function bumpGeneration(): void {
  storage.setItem(GENERATION_KEY, String(readGeneration() + 1));
}

function storeSession(token: string, user: AccountUser | null): void {
  storage.setItem(SESSION_KEY, token);
  if (user) storage.setItem(USER_KEY, JSON.stringify(user));
  else storage.removeItem(USER_KEY);
  storage.removeItem(LAPSED_KEY);
  bumpGeneration();
}

/**
 * Keys a reader leaves behind, by prefix: chapter progress and saved places (lane B keeps one per
 * chapter under these, `tt.progress…` and `tt.checkpoint…`), and the Storyteller's cached shelf.
 */
export const READER_KEY_PREFIXES = [PROGRESS_KEY, 'tt.chapters', CHECKPOINT_KEY, 'tt.storyteller.'] as const;

/** Every stored key that starts with one of the reader's prefixes. Empty if storage can't be read. */
function readerKeys(): string[] {
  try {
    const local = globalThis.localStorage;
    if (!local) return [];
    const keys: string[] = [];
    for (let i = 0; i < local.length; i++) {
      const key = local.key(i);
      if (key && READER_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

/**
 * Leaves this headset a fresh guest: no session, no chapters' progress (`tt.progress`,
 * `tt.chapters`), no saved place (every `tt.checkpoint…`), no shelf. The caller reloads the page.
 */
function clearReader(): void {
  for (const key of [SESSION_KEY, USER_KEY, LAPSED_KEY, PROGRESS_KEY, CHECKPOINT_KEY, ...readerKeys()]) storage.removeItem(key);
  try {
    // Lane B's own list of what chapters keep, whatever their keys become.
    if (globalThis.localStorage) forgetLocalChapters(globalThis.localStorage);
  } catch {
    // Storage gone: nothing left to clear.
  }
  bumpGeneration();
}

/**
 * A reader leaves this headset (sign-out, deletion): the generation changes first, so a write
 * still in flight notices and drops itself, then their private pages waiting for the server are
 * deleted, and that deletion is awaited. The shared keepsakes stay (owner's policy).
 */
async function leaveReader(): Promise<void> {
  const readerId = userFrom(readJson(USER_KEY))?.id ?? null;
  clearReader();
  if (readerId) await forgetReaderPending(readerId);
}

/** True when this headset was signed in and the server no longer knows the session: "Sign in again to keep your book in sync". */
export function sessionLapsed(): boolean {
  return storage.getItem(LAPSED_KEY) === '1';
}

// ---- requests -----------------------------------------------------------------

interface Answer {
  status: number;
  json: unknown;
  headers: Headers;
}

const send = withDeadline((input, init) => fetch(input, init));

/** One request. Null when it never got an answer (offline, timed out, no fetch). */
async function request(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Answer | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const headers: Record<string, string> = { accept: 'application/json', ...init.headers };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    const response = await send(url, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
    const text = await response.text().catch(() => '');
    let json: unknown = null;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json, headers: response.headers };
  } catch {
    return null;
  }
}

const bearer = (token: string | null): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {});

const errorCode = (answer: Answer): string => {
  const body = record(answer.json);
  return typeof body?.error === 'string' ? body.error : typeof body?.code === 'string' ? body.code : '';
};

let access: BackendAccess | null = null;
const deviceAccess = (): BackendAccess =>
  (access ??= createBackendAccess({ baseUrl: BASE, fetch: send, storage, now: () => Date.now() }));

/** The backend for app routes, with the device token and, when signed in, the session beside it (the Storyteller's provider). */
export const readerBackend = (): BackendAccess => deviceAccess();

/** Who this browser last knew was signed in, without asking the server. Null for a guest. */
export function cachedReader(): AccountUser | null {
  if (!sessionToken()) return null;
  return userFrom(readJson(USER_KEY));
}

/** An app route under `/v1/me/*`: the contract header, the device token as always, and the session beside it. */
async function meRequest(path: string, method: string, body?: unknown): Promise<Answer | null> {
  const session = sessionToken();
  if (!session) return null;
  const device = await deviceAccess().deviceToken().catch(() => null);
  if (!device) return null;
  return request(`${BASE}${path}`, {
    method,
    body,
    headers: { [CONTRACT_HEADER]: String(CONTRACT_VERSION), authorization: `Bearer ${device}`, [SESSION_HEADER]: session },
  });
}

// ---- the session --------------------------------------------------------------

/**
 * Who is signed in on this browser, or null for a guest. Offline it trusts the last answer. A
 * session the server no longer knows is forgotten, and `sessionLapsed()` turns true.
 */
export async function getSession(): Promise<{ user: AccountUser } | null> {
  try {
    const token = sessionToken();
    if (!token) return null;
    const cached = userFrom(readJson(USER_KEY));
    const answer = await request(`${AUTH}/get-session`, { headers: bearer(token) });
    if (!answer || answer.status >= 500) return cached ? { user: cached } : null;
    const user = answer.status === 200 ? userFrom(record(answer.json)?.user) : null;
    if (user) {
      storage.setItem(USER_KEY, JSON.stringify(user));
      return { user };
    }
    if (answer.status === 200 || answer.status === 401) {
      for (const key of [SESSION_KEY, USER_KEY]) storage.removeItem(key);
      storage.setItem(LAPSED_KEY, '1');
      bumpGeneration();
    }
    return null;
  } catch {
    return null;
  }
}

/** Takes a session token from an answer: Better Auth's `set-auth-token` header, else the body. */
function tokenFrom(answer: Answer, fromBody: string | undefined): string | null {
  return answer.headers.get('set-auth-token') || fromBody || null;
}

// ---- the headset: a code finished on the phone ---------------------------------

interface PendingCode {
  deviceCode: string;
  intervalMs: number;
  expiresAtMs: number;
}

let pending: PendingCode | null = null;

/** "ABCD2345" as "ABCD-2345", the way the bookplate shows it. */
const showCode = (code: string): string => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

/** What someone typed, as the server stores it: capitals and digits only. */
const typedCode = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** The code the bookplate shows, finished on the phone. */
export interface DeviceCode {
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
}

/** A new code for the bookplate. Null when the backend can't be reached. Replaces any code before it. */
export async function startDeviceSignIn(): Promise<DeviceCode | null> {
  try {
    const answer = await request(`${AUTH}/device/code`, { method: 'POST', body: { client_id: DEVICE_CLIENT_ID } });
    const body = record(answer?.json);
    if (!answer || answer.status !== 200 || !body || typeof body.device_code !== 'string' || typeof body.user_code !== 'string') return null;
    const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 600;
    const interval = typeof body.interval === 'number' ? body.interval : 5;
    pending = { deviceCode: body.device_code, intervalMs: interval * 1000, expiresAtMs: Date.now() + expiresIn * 1000 };
    return {
      userCode: showCode(body.user_code),
      verificationUrl: typeof body.verification_uri === 'string' ? body.verification_uri : '',
      expiresAt: new Date(pending.expiresAtMs).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Waits for the phone. Reports `pending` after each check, then exactly one of `approved` (the
 * session is stored), `denied` or `expired`. Slows down when the server says so. Returns a cancel.
 */
export function pollDeviceSignIn(onUpdate: (status: DeviceSignInStatus) => void): () => void {
  const code = pending;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const report = (status: DeviceSignInStatus): void => {
    if (stopped) return;
    try {
      onUpdate(status);
    } catch {
      // The UI's own problem; polling carries on.
    }
  };
  const finish = (status: DeviceSignInStatus): void => {
    report(status);
    stopped = true;
    if (pending === code) pending = null;
  };
  if (!code) {
    queueMicrotask(() => finish('expired'));
    return () => void (stopped = true);
  }
  let interval = code.intervalMs;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    if (Date.now() >= code.expiresAtMs) return finish('expired');
    const answer = await request(`${AUTH}/device/token`, {
      method: 'POST',
      body: { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: code.deviceCode, client_id: DEVICE_CLIENT_ID },
    });
    if (stopped) return;
    const body = record(answer?.json);
    if (answer?.status === 200 && typeof body?.access_token === 'string') {
      storeSession(body.access_token, null);
      await getSession();
      // A stored session must always reach the reader change (a reload), even if Cancel came
      // while it was being looked up: report it regardless of `stopped` (PR review 5).
      stopped = false;
      return finish('approved');
    }
    const error = answer ? errorCode(answer) : 'offline';
    if (error === 'access_denied') return finish('denied');
    if (error === 'expired_token' || error === 'invalid_grant') return finish('expired');
    // RFC 8628: each slow_down adds five seconds for the rest of this code.
    if (error === 'slow_down') interval += 5000;
    report('pending');
    timer = setTimeout(() => void tick(), interval);
  };
  timer = setTimeout(() => void tick(), interval);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

// ---- the agreed names (docs/plans/2026-11-16-finish-api-shapes.md §2) --------------------

/** The bookplate's phone code. */
export const startPhoneSignIn = (): Promise<DeviceCode | null> => startDeviceSignIn();

/** Waits for the phone; one of approved, denied or expired ends it. Returns a cancel. */
export const watchPhoneSignIn = (cb: (s: DeviceSignInStatus) => void): (() => void) => pollDeviceSignIn(cb);

/**
 * Where "Continue with Google" navigates. Google is the only provider in v1 (Facebook is v2: owner,
 * Nov 16). Null when sign-in is off in this build.
 */
export function providerSignInUrl(provider: 'google', returnTo: string): string | null {
  if (!ACCOUNTS_ON) return null;
  return provider === 'google' ? googleStartUrl(returnTo) : null;
}

/**
 * Finishes a provider's return on `/auth/return/`: trades the one-time code in the address for the
 * session, removes it from the address, records this headset and merges its book. No reload of
 * its own: the page decides where to go (and keeps `tt.enter`).
 */
export async function finishSignIn(): Promise<'ok' | 'failed'> {
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const ott = params.get('ott');
  try {
    globalThis.history?.replaceState(null, '', globalThis.location?.pathname ?? '/');
  } catch {
    // The address keeps the code until the reload; it's single-use and short-lived either way.
  }
  if (!ott || params.get('error')) return 'failed';
  if (!(await finishGoogleReturn(ott))) return 'failed';
  const back = params.get('return') ?? '';
  // The phone's page approves the headset itself; a headset records itself and merges its book.
  if (!back.includes('/link/')) {
    await linkThisDevice();
    writeLocalBook(await syncBook(readLocalBook()), 'flagship-1');
  }
  return 'ok';
}

// ---- Google, by top-level navigation on the API's own address -----------------

/** Where "Continue with Google" navigates. Google ends on `/auth/return/?ott=…&return=<returnTo>` (or `&error=google`). */
export function googleStartUrl(returnTo: string): string {
  let target = returnTo;
  try {
    target = new URL(returnTo, globalThis.location?.href).href;
  } catch {
    // Already absolute, or no location to resolve against.
  }
  return `${AUTH}/google/start?return=${encodeURIComponent(target)}`;
}

/** Trades the one-time code from Google's return for the session. True when signed in. */
export async function finishGoogleReturn(ott: string): Promise<boolean> {
  try {
    const answer = await request(`${AUTH}/one-time-token/verify`, { method: 'POST', body: { token: ott } });
    if (!answer || answer.status !== 200) return false;
    const body = record(answer.json);
    const session = record(body?.session);
    const token = tokenFrom(answer, typeof session?.token === 'string' ? session.token : undefined);
    if (!token) return false;
    storeSession(token, userFrom(body?.user));
    return true;
  } catch {
    return false;
  }
}

// ---- the phone's link page ----------------------------------------------------

/** Whether a headset's code is real and still waiting. Before sign-in this only checks it. */
export async function phoneVerifyCode(code: string): Promise<CodeCheck> {
  try {
    const answer = await request(`${AUTH}/device?user_code=${encodeURIComponent(typedCode(code))}`, { headers: bearer(sessionToken()) });
    if (!answer) return 'offline';
    if (answer.status !== 200) return errorCode(answer) === 'expired_token' ? 'expired' : 'invalid';
    const status = record(answer.json)?.status;
    return status === 'approved' || status === 'denied' ? status : 'pending';
  } catch {
    return 'offline';
  }
}

/** Emails a six-digit code. True when it was sent. */
export async function emailSendCode(email: string): Promise<boolean> {
  try {
    const answer = await request(`${AUTH}/email-otp/send-verification-otp`, { method: 'POST', body: { email: email.trim(), type: 'sign-in' } });
    return answer?.status === 200;
  } catch {
    return false;
  }
}

/** Signs in with the emailed code. */
export async function emailVerify(email: string, code: string): Promise<EmailVerify> {
  try {
    const answer = await request(`${AUTH}/sign-in/email-otp`, { method: 'POST', body: { email: email.trim(), otp: code.replace(/\s/g, '') } });
    if (!answer) return 'failed';
    const body = record(answer.json);
    if (answer.status === 200) {
      const token = tokenFrom(answer, typeof body?.token === 'string' ? body.token : undefined);
      if (!token) return 'failed';
      storeSession(token, userFrom(body?.user));
      return 'ok';
    }
    const reason = errorCode(answer);
    if (reason === 'OTP_EXPIRED' || reason === 'TOO_MANY_ATTEMPTS') return 'expired';
    if (reason === 'INVALID_OTP') return 'wrong-code';
    return 'failed';
  } catch {
    return 'failed';
  }
}

/** Claims the code for the signed-in phone, then answers it. */
async function answerDevice(code: string, verdict: 'approve' | 'deny'): Promise<PhoneAnswer> {
  try {
    const token = sessionToken();
    if (!token) return 'signed-out';
    const userCode = typedCode(code);
    const claim = await request(`${AUTH}/device?user_code=${encodeURIComponent(userCode)}`, { headers: bearer(token) });
    if (!claim) return 'failed';
    if (claim.status !== 200) return errorCode(claim) === 'expired_token' ? 'expired' : 'invalid';
    const answer = await request(`${AUTH}/device/${verdict}`, { method: 'POST', body: { userCode }, headers: bearer(token) });
    if (!answer) return 'failed';
    if (answer.status === 200) return 'ok';
    if (answer.status === 401) return 'signed-out';
    const reason = errorCode(answer);
    if (reason === 'expired_token') return 'expired';
    return reason === 'invalid_request' || reason === 'access_denied' ? 'invalid' : 'failed';
  } catch {
    return 'failed';
  }
}

/** "Yes, sign it in." */
export const approveDevice = (code: string): Promise<PhoneAnswer> => answerDevice(code, 'approve');

/** "No, that's not mine." The headset hears `denied`. */
export const denyDevice = (code: string): Promise<PhoneAnswer> => answerDevice(code, 'deny');

/** Records this headset on the account, so deleting the account clears it too. A record, never a key. True when recorded. */
export async function linkThisDevice(label?: string): Promise<boolean> {
  try {
    const answer = await meRequest(accountRoutes.linkDevice.path, accountRoutes.linkDevice.method, label ? { label: label.slice(0, 80) } : {});
    return answer?.status === 200;
  } catch {
    return false;
  }
}

// ---- the book ------------------------------------------------------------------

/**
 * This headset's book, from the progress and the saved place the show keeps. A chapter number
 * below the one in progress is finished; the saved place counts while it's fresh and not at an end.
 */
/** The book's series, as the manifest names it. */
const SERIES_ID = 'flagship-1';

/**
 * This headset's book as the account syncs it, through lane B's adapter: each chapter's own state
 * (nothing inferred, so a direct start of chapter 3 never claims 1 and 2 as finished) and the
 * latest fresh saved place.
 */
export function readLocalBook(seriesId: string = SERIES_ID): LocalBook {
  try {
    const store = globalThis.localStorage;
    if (!store) return { chapters: {}, resume: null, updatedAt: EPOCH };
    return readLocalChapters(store, seriesId);
  } catch {
    return { chapters: {}, resume: null, updatedAt: EPOCH };
  }
}

/**
 * Writes a merged book back as the progress the landing reads, when it says more than this
 * headset knew. The saved place itself stays on the headset that made it.
 */
/**
 * Writes the merged book back through lane B's adapter, which takes the whole merged book: each
 * chapter only moves forward, so a completion on another headset reaches this one's library.
 */
export function writeLocalBook(book: LocalBook, seriesId: string = SERIES_ID): void {
  try {
    const store = globalThis.localStorage;
    if (store) writeLocalChapters(store, seriesId, book);
  } catch {
    // The landing keeps what it had.
  }
}

type Fetched = { kind: 'ok'; book: Book } | { kind: 'stale' } | { kind: 'signed-out' } | { kind: 'offline' };

async function fetchBook(): Promise<Fetched> {
  const answer = await meRequest(accountRoutes.getBook.path, accountRoutes.getBook.method);
  if (!answer) return sessionToken() ? { kind: 'offline' } : { kind: 'signed-out' };
  if (answer.status === 401) return { kind: 'signed-out' };
  const parsed = Book.safeParse(answer.json);
  return answer.status === 200 && parsed.success ? { kind: 'ok', book: parsed.data } : { kind: 'offline' };
}

async function storeBook(baseRev: number, book: LocalBook): Promise<Fetched> {
  const body: BookPut = { baseRev, chapters: book.chapters, resume: book.resume };
  const answer = await meRequest(accountRoutes.putBook.path, accountRoutes.putBook.method, body);
  if (!answer) return { kind: 'offline' };
  if (answer.status === 409) return { kind: 'stale' };
  if (answer.status === 401) return { kind: 'signed-out' };
  const parsed = Book.safeParse(answer.json);
  return answer.status === 200 && parsed.success ? { kind: 'ok', book: parsed.data } : { kind: 'offline' };
}

const local = (book: Book): LocalBook => ({ chapters: book.chapters, resume: book.resume, updatedAt: book.updatedAt });

/** Merges and uploads. On a stale revision it fetches, merges and retries once. */
async function sync(mine: LocalBook): Promise<{ book: LocalBook; outcome: 'synced' | 'offline' | 'signed-out' }> {
  if (!sessionToken()) return { book: mine, outcome: 'signed-out' };
  const generation = readGeneration();
  for (let attempt = 0; attempt < 2; attempt++) {
    const server = await fetchBook();
    if (readGeneration() !== generation) return { book: mine, outcome: 'offline' };
    if (server.kind !== 'ok') return { book: mine, outcome: server.kind === 'signed-out' ? 'signed-out' : 'offline' };
    const merged = mergeBooks(mine, local(server.book));
    if (sameBook(merged, server.book)) return { book: merged, outcome: 'synced' };
    // A different reader since this began: the write belongs to nobody now.
    if (readGeneration() !== generation) return { book: mine, outcome: 'offline' };
    const stored = await storeBook(server.book.rev, merged);
    if (readGeneration() !== generation) return { book: mine, outcome: 'offline' };
    if (stored.kind === 'ok') return { book: mergeBooks(merged, local(stored.book)), outcome: 'synced' };
    if (stored.kind !== 'stale') return { book: mine, outcome: stored.kind === 'signed-out' ? 'signed-out' : 'offline' };
  }
  return { book: mine, outcome: 'offline' };
}

/**
 * Your book on the server, merged with this headset's. Returns the merged book, or the local one
 * unchanged when signed out or offline. Pass the result to `writeLocalBook` to show it here.
 */
export async function syncBook(mine: LocalBook = readLocalBook()): Promise<LocalBook> {
  try {
    return (await sync(mine)).book;
  } catch {
    return mine;
  }
}

/**
 * Saves the book to the account, then leaves a fresh guest headset. Offline, it returns
 * `offline` and changes nothing, unless `force`, which drops the unsaved work for good. The caller reloads.
 */
export async function signOut({ force = false }: { force?: boolean } = {}): Promise<'ok' | 'offline'> {
  try {
    const token = sessionToken();
    if (token) {
      const { outcome } = await sync(readLocalBook()).catch(() => ({ outcome: 'offline' as const }));
      if (outcome === 'offline' && !force) return 'offline';
      // Best effort: an offline sign-out leaves the session to expire on its own.
      await request(`${AUTH}/sign-out`, { method: 'POST', body: {}, headers: bearer(token) });
    }
  } catch {
    if (!force) return 'offline';
  }
  await leaveReader();
  return 'ok';
}

/**
 * Deletes the account, its book and its device links, then clears this headset. A sign-in more
 * than a day old must be renewed first (`needs-fresh-sign-in`). `failed` when it couldn't be reached. The caller reloads.
 */
export async function deleteAccount(): Promise<'ok' | 'needs-fresh-sign-in' | 'failed'> {
  try {
    const token = sessionToken();
    if (!token) return 'needs-fresh-sign-in';
    const answer = await request(`${AUTH}/delete-user`, { method: 'POST', body: {}, headers: bearer(token) });
    if (!answer) return 'failed';
    if (answer.status === 200) {
      await leaveReader();
      return 'ok';
    }
    if (answer.status === 401 || errorCode(answer) === 'SESSION_EXPIRED') return 'needs-fresh-sign-in';
    return 'failed';
  } catch {
    return 'failed';
  }
}
