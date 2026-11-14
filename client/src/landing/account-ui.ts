/**
 * What the page needs from accounts, on top of the data layer in client/src/account/.
 * Every change of reader (sign-in, sign-out, delete) ends in a reload, so nothing of the
 * previous reader is still running (plan, review round 2).
 */
import {
  deleteAccount,
  getSession,
  googleStartUrl,
  linkThisDevice,
  pollDeviceSignIn,
  readGeneration,
  readLocalBook,
  sessionLapsed,
  signOut,
  startDeviceSignIn,
  syncBook,
  writeLocalBook,
  type DeviceSignInStatus,
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

/** After any sign-in: record this headset, merge its guest book into the account's, then start fresh. */
export async function finishSignIn(): Promise<void> {
  await linkThisDevice(navigator.userAgent.includes('Quest') ? 'Meta Quest' : undefined);
  writeLocalBook(await syncBook(readLocalBook()), SERIES_ID);
  location.reload();
}

export type DeviceCode = { userCode: string; verificationUrl: string; expiresAt: string };

export async function startPhoneSignIn(): Promise<DeviceCode | null> {
  return startDeviceSignIn();
}

export function watchPhoneSignIn(onUpdate: (status: DeviceSignInStatus) => void): () => void {
  return pollDeviceSignIn(onUpdate);
}

export function googleSignInUrl(returnTo: string): string | null {
  return googleStartUrl(returnTo);
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
