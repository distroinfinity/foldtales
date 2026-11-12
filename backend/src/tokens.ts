import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

const sign = (secret: string, body: string): string => createHmac('sha256', secret).update(body).digest('base64url');

export function issueToken(secret: string, now: Date, deviceId: string = randomUUID()): { deviceId: string; token: string; expiresAt: string } {
  const expiresMs = now.getTime() + LIFETIME_MS;
  const body = `${deviceId}.${expiresMs}`;
  return { deviceId, token: `${body}.${sign(secret, body)}`, expiresAt: new Date(expiresMs).toISOString() };
}

/** The device a token belongs to, or null. `allowExpired` is only for renewing, which keeps the identity. */
export function verifyToken(secret: string, token: string, now: Date, options: { allowExpired?: boolean } = {}): string | null {
  const [deviceId, expires, signature, ...rest] = token.split('.');
  if (!deviceId || !expires || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(secret, `${deviceId}.${expires}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!options.allowExpired && Number(expires) <= now.getTime()) return null;
  return deviceId;
}
