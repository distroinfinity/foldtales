/**
 * What the page needs from accounts. The data layer (client/src/account/) is being built in parallel;
 * until it's merged, this stands in with "signed out" so the page can be built and checked.
 * Swap these for the real module's exports when it lands.
 */
export type Reader = { name: string; email: string } | null;

export async function currentReader(): Promise<Reader> {
  return null;
}

export type DeviceCode = { userCode: string; verificationUrl: string; expiresAt: number };

export async function startPhoneSignIn(): Promise<DeviceCode | null> {
  return null;
}

export function googleSignInUrl(_returnTo: string): string | null {
  return null;
}
