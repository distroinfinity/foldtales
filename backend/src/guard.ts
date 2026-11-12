import { AsyncLocalStorage } from 'node:async_hooks';
import { createHmac } from 'node:crypto';
import { BackendError, routes, type RouteName } from '@tabletop/contracts';
import type { MiddlewareHandler } from 'hono';
import type { Store } from './store.ts';
import { verifyToken } from './tokens.ts';

export interface Caps {
  deviceFeature: number;
  feature: number;
  global: number;
  devices: number;
  memoryDevice: number;
  telemetryDevice: number;
  writes: number;
  identitiesPerAddress: number;
}

const CAP_DEFAULTS: Record<keyof Caps, [string, number]> = {
  deviceFeature: ['CAP_DEVICE_FEATURE', 200],
  feature: ['CAP_FEATURE', 2_000],
  global: ['CAP_GLOBAL', 5_000],
  devices: ['CAP_DEVICES', 1_000],
  memoryDevice: ['CAP_MEMORY_DEVICE', 2_000],
  telemetryDevice: ['CAP_TELEMETRY_DEVICE', 2_000],
  writes: ['CAP_WRITES', 200_000],
  identitiesPerAddress: ['CAP_IDENTITIES_PER_ADDRESS', 20],
};

export function readCaps(env: Record<string, string | undefined>): Caps {
  const entries = Object.entries(CAP_DEFAULTS).map(([key, [name, fallback]]) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a whole number, zero or more`);
    return [key, value];
  });
  return Object.fromEntries(entries) as Caps;
}

const AI_ROUTES = new Set<RouteName>(['planBeat', 'planSpine', 'reactToObject', 'replyAsCharacter', 'speakLine', 'speechToken']);
const MEMORY_ROUTES = new Set<RouteName>(['memoryAppend', 'memoryRead', 'memoryDelete']);
const routeOfPath = new Map(Object.entries(routes).map(([name, route]) => [route.path as string, name as RouteName]));

interface Caller {
  deviceId: string | null;
}

const caller = new AsyncLocalStorage<Caller>();

/** The authenticated device. On `/v1/device`, it's the device being renewed, or null for a new one. */
export const currentDevice = (): string | null => caller.getStore()?.deviceId ?? null;

export interface GuardConfig {
  secret: string;
  caps: Caps;
  now: () => Date;
}

const bearerOf = (header: string | undefined): string | null => header?.match(/^Bearer (.+)$/)?.[1] ?? null;

/** Authentication and caps. Counting comes before the handler, so a failed count never runs an AI route. */
export function guard(store: Store, { secret, caps, now }: GuardConfig): MiddlewareHandler {
  return async (c, next) => {
    const route = routeOfPath.get(c.req.path);
    if (!route) return next();

    const time = now();
    const day = time.toISOString().slice(0, 10);
    const bearer = bearerOf(c.req.header('authorization'));
    const spend = (scope: string, feature: string, cap: number, message: string): void => {
      if (store.countUse(day, scope, feature) > cap) throw new BackendError('quota_exceeded', message);
    };

    if (route === 'issueDevice') {
      const renewing = bearer ? verifyToken(secret, bearer, time, { allowExpired: true }) : null;
      if (!renewing) {
        // X-Real-IP is set by the host's proxy. It's kept only as a keyed hash.
        const address = createHmac('sha256', secret).update(c.req.header('x-real-ip') ?? 'unknown').digest('base64url');
        spend(`address:${address}`, 'identity', caps.identitiesPerAddress, 'too many new devices from this address today');
        spend('all', 'identity', caps.devices, 'too many new devices today');
      }
      return caller.run({ deviceId: renewing }, next);
    }

    const deviceId = bearer ? verifyToken(secret, bearer, time) : null;
    if (!deviceId) throw new BackendError('unauthorized', 'a valid device token is required');

    const device = `device:${deviceId}`;
    if (AI_ROUTES.has(route)) {
      spend(device, route, caps.deviceFeature, 'this device has reached its daily limit');
      spend('all', route, caps.feature, 'this feature has reached its daily limit');
      spend('all', 'ai', caps.global, 'the daily limit has been reached');
    } else {
      if (MEMORY_ROUTES.has(route)) spend(device, 'memory', caps.memoryDevice, 'this device has reached its daily memory limit');
      if (route === 'sendTelemetry') spend(device, 'telemetry', caps.telemetryDevice, 'this device has reached its daily telemetry limit');
      spend('all', 'writes', caps.writes, 'the daily write limit has been reached');
    }
    return caller.run({ deviceId }, next);
  };
}
