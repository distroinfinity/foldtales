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
  const before = localStorage.getItem('tt.progress');
  const merged = await syncBook(readLocalBook());
  writeLocalBook(merged, SERIES_ID);
  if (localStorage.getItem('tt.progress') !== before && !sessionStorage.getItem('tt.pulled')) {
    sessionStorage.setItem('tt.pulled', '1');
    location.reload();
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
  if (result === 'ok') location.reload();
  return result;
}

export async function deleteMyBook(): Promise<'ok' | 'needs-fresh-sign-in' | 'failed'> {
  const result = await deleteAccount();
  if (result === 'ok') location.reload();
  return result;
}
