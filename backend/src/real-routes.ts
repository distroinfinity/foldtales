import { BackendError, type BackendApi } from '@tabletop/contracts';
import { currentDevice } from './guard.ts';
import type { Store } from './store.ts';
import { issueToken } from './tokens.ts';

const MAX_APPEND = 500;

function device(): string {
  const id = currentDevice();
  if (!id) throw new BackendError('unauthorized', 'a valid device token is required');
  return id;
}

export type RealRoutes = Pick<BackendApi, 'issueDevice' | 'memoryAppend' | 'memoryRead' | 'memoryDelete' | 'sendTelemetry'>;

/** The routes that are real from day one. The AI routes stay mocked until their tickets. */
export function realRoutes(store: Store, secret: string, now: () => Date): RealRoutes {
  return {
    issueDevice: async () => issueToken(secret, now(), currentDevice() ?? undefined),
    memoryAppend: async ({ seriesId, events }) => {
      if (events.length > MAX_APPEND) throw new BackendError('bad_request', `at most ${MAX_APPEND} events per append`);
      if (events.some((event) => event.seriesId !== seriesId)) throw new BackendError('bad_request', 'an event belongs to a different series');
      return { lastSeq: store.appendEvents(device(), seriesId, events as Parameters<Store['appendEvents']>[2]) };
    },
    memoryRead: async ({ seriesId, afterSeq }) => ({ events: store.readEvents(device(), seriesId, afterSeq) }),
    memoryDelete: async ({ seriesId }) => ({ deleted: store.deleteSeries(device(), seriesId) }),
    sendTelemetry: async ({ buildId, sessionId, events }) => {
      store.addTelemetry(device(), buildId, sessionId, events, now());
      return { accepted: events.length };
    },
  };
}
