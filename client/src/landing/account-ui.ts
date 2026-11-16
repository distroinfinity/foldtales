/**
 * What the page needs from accounts, on top of the data layer in client/src/account/.
 * Every change of reader (sign-in, sign-out, delete) ends in a reload, so nothing of the
 * previous reader is still running (plan, review round 2).
 */
import {
  deleteAccount,
  getSession,
  startGoogleSignIn,
  linkThisDevice,
  pollDeviceSignIn,
  readGeneration,
  signInMethods,
  readLocalBook,
  sessionLapsed,
  signOut,
  startDeviceSignIn,
  syncBook,
  writeLocalBook,
  type DeviceSignInStatus,
  type SignInMethods,
} from '../account/index.ts';

const SERIES_ID = 'flagship-1';

export type Reader = { name: string; email: string } | null;

export async function currentReader(): Promise<Reader> {
  const session = await getSession();
  if (!session) return null;
  const first = session.user.name?.trim().split(/\s+/)[0];
  return { name: first || session.user.email.split('@')[0]!, email: session.user.email };
}

/** True when a sign-in from before has lapsed, so the page can say "Sign in again". */
export const signInLapsed = (): boolean => sessionLapsed();

/**
 * A signed-in visit: bring this headset's book up to date from the account. If the account knew
 * more (a chapter finished on another headset), reload once so the 3D side starts from it.
 */
export async function pullBook(): Promise<void> {
  const generation = readGeneration();
  const before = localStorage.getItem('tt.progress');
  const merged = await syncBook(readLocalBook());
  if (readGeneration() !== generation) return;
  writeLocalBook(merged, SERIES_ID);
  const after = localStorage.getItem('tt.progress');
  // Reload once per book actually imported, so the 3D side starts from it; never loop.
  if (after !== before && sessionStorage.getItem('tt.pulled') !== after) {
    sessionStorage.setItem('tt.pulled', after ?? '');
    location.reload();
    return;
  }
  sessionStorage.removeItem('tt.pulled');
}

/** Signed in: save this headset's progress to the account (after a chapter, or on leaving the book). */
export async function pushBook(): Promise<void> {
  await syncBook(readLocalBook());
}

/**
 * A reader change ends in a reload, but the old show's own pagehide writer saves its place on the way
 * out, after the clear. So the next load clears once more, before the book reads anything (main.ts).
 */
const CLEAR_ON_LOAD = 'tt.clear-reader';
function reloadAsNewReader(): void {
  try {
    sessionStorage.setItem(CLEAR_ON_LOAD, '1');
  } catch {
    // Without session storage the clear already done stands.
  }
  location.reload();
}

/** Called first thing on every load, before the 3D side reads the saved place. */
export function clearIfReaderChanged(): void {
  try {
    if (sessionStorage.getItem(CLEAR_ON_LOAD) !== '1') return;
    sessionStorage.removeItem(CLEAR_ON_LOAD);
    for (const key of ['tt.progress', 'tt.checkpoint']) localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

// ---- The sign-in round trip: what it was for, and how it ended ----------------------------

/** What a sign-in was started for: the Storyteller's door, or just the bookplate (null). */
export type SignInFor = 'storyteller' | null;
/** How a Google sign-in came back without a session, as `/auth/return/` reads it from the address. */
export type SignInProblem = 'google' | 'google-cancelled' | 'google-off';

interface SignInTrip {
  for: SignInFor;
  at: number;
  /** Where on the page the reader was, so the page comes back to the same door. */
  y?: number;
  outcome?: 'ok' | SignInProblem;
}

const TRIP = 'tt.sign-in';
/** Untouched this long, a started sign-in is forgotten (as a chosen entry is). */
const TRIP_TTL_MS = 30 * 60_000;

function readTrip(now = Date.now()): SignInTrip | null {
  try {
    const trip = JSON.parse(sessionStorage.getItem(TRIP) ?? 'null') as SignInTrip | null;
    if (!trip || typeof trip.at !== 'number' || now - trip.at > TRIP_TTL_MS) return null;
    return trip.for === 'storyteller' || trip.for === null ? trip : null;
  } catch {
    return null;
  }
}

function writeTrip(trip: SignInTrip | null): void {
  try {
    if (trip) sessionStorage.setItem(TRIP, JSON.stringify(trip));
    else sessionStorage.removeItem(TRIP);
  } catch {
    // Without session storage the reader lands at the top of the page, signed in all the same.
  }
}

/**
 * A sign-in is starting, from the Storyteller's door or from the bookplate. Kept in this tab across
 * Google's round trip and the reload after a phone code, so the reader comes back to the same door.
 */
export function signInFor(target: SignInFor, y: number = globalThis.scrollY ?? 0): void {
  writeTrip({ for: target, at: Date.now(), y: Math.max(0, Math.round(y)) });
}

/**
 * Signed in. The page comes back to where the sign-in started; the Storyteller's door there now
 * opens. Nothing is chosen for the reader: the chapters' card keeps speaking for the chapters.
 */
export function signedIn(): void {
  const trip = readTrip();
  writeTrip({ for: trip?.for ?? null, at: Date.now(), y: trip?.y, outcome: 'ok' });
}

/** Google came back without a session: the page that started it says why. */
export function signInFailed(problem: SignInProblem): void {
  const trip = readTrip();
  writeTrip({ for: trip?.for ?? null, at: Date.now(), y: trip?.y, outcome: problem });
}

const PROBLEMS: Record<SignInProblem, string> = {
  google: 'Google didn’t finish signing you in. Try again, or use your phone.',
  'google-cancelled': 'You didn’t finish signing in with Google, so nothing changed. Try again, or use your phone.',
  'google-off': 'Signing in with Google isn’t available just now. Use your phone instead.',
};

/** The phone's page offers an email code where the headset offers the phone. */
const PHONE_PROBLEMS: Record<SignInProblem, string> = {
  google: 'Google didn’t finish signing you in. Try again, or get a code by email.',
  'google-cancelled': 'You didn’t finish signing in with Google, so nothing changed. Try again, or get a code by email.',
  'google-off': 'Signing in with Google isn’t available just now. Get a code by email instead.',
};

/** The words for a problem from the address (`error=` or `problem=`). Unknown ones read as Google's failure. */
export function signInProblemText(code: string | null, page: 'headset' | 'phone' = 'headset'): string | null {
  return code ? (page === 'phone' ? PHONE_PROBLEMS : PROBLEMS)[readProblem(code)] : null;
}

/** A problem code from the address; anything unknown reads as Google's failure. */
export function readProblem(raw: string | null): SignInProblem {
  return raw !== null && raw in PROBLEMS ? (raw as SignInProblem) : 'google';
}

/** Where Google's return goes: the page that asked, if it's on this site, else home. */
export function returnTarget(requested: string | null, here: string, home: string): URL {
  try {
    const url = requested ? new URL(requested, here) : null;
    if (url && url.origin === new URL(here).origin) return url;
  } catch {
    // Home it is.
  }
  return new URL(home);
}

/**
 * Where a return without a session goes. The phone's page goes back to its sign-in step with the
 * headset's code and the problem in its address; the headset's page is left as it was, and the
 * problem travels in this tab's session storage (`signInFailed`).
 */
export function failedTarget(target: URL, problem: SignInProblem): string {
  if (!target.pathname.includes('/link/')) return target.href;
  const back = new URL(target.href);
  back.searchParams.set('step', 'sign-in');
  back.searchParams.set('problem', problem);
  return back.href;
}

/** On load, once: the round trip that just ended, where it started, and what to say if it failed. */
export function takeSignInReturn(): { for: SignInFor; y: number; problem: string | null } | null {
  const trip = readTrip();
  if (!trip?.outcome) return null;
  writeTrip(null);
  return { for: trip.for, y: trip.y ?? 0, problem: trip.outcome === 'ok' ? null : signInProblemText(trip.outcome) };
}

/** Which ways in are switched on; null when the backend couldn't say. */
export function availableSignIn(): Promise<SignInMethods | null> {
  return signInMethods();
}

/** After any sign-in: record this headset, merge its guest book into the account's, then start fresh. */
export async function finishSignIn(): Promise<void> {
  await linkThisDevice(navigator.userAgent.includes('Quest') ? 'Meta Quest' : undefined);
  writeLocalBook(await syncBook(readLocalBook()), SERIES_ID);
  signedIn();
  location.reload();
}

export type DeviceCode = { userCode: string; verificationUrl: string; expiresAt: string };

export async function startPhoneSignIn(): Promise<DeviceCode | null> {
  return startDeviceSignIn();
}

export function watchPhoneSignIn(onUpdate: (status: DeviceSignInStatus) => void): () => void {
  return pollDeviceSignIn(onUpdate);
}

/** "Continue with Google": off to Google from this tab, which keeps the nonce its return is redeemed with. */
export function googleSignIn(returnTo: string): void {
  void startGoogleSignIn(returnTo);
}

/** Sign out, saving first. `offline` means nothing changed: the page asks before forcing it. */
export async function signOutHere(force = false): Promise<'ok' | 'offline'> {
  const result = await signOut({ force });
  if (result === 'ok') reloadAsNewReader();
  return result;
}

export async function deleteMyBook(): Promise<'ok' | 'needs-fresh-sign-in' | 'failed'> {
  const result = await deleteAccount();
  if (result === 'ok') reloadAsNewReader();
  return result;
}
