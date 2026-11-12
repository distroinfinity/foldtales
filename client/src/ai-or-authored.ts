import { BackendError, type FallbackReason } from '@tabletop/contracts';

function reasonFor(cause: unknown): FallbackReason {
  if (!(cause instanceof BackendError)) return 'failed';
  if (cause.code === 'quota_exceeded') return 'cap';
  if (cause.message.startsWith('network failure')) return cause.message.includes('TimeoutError') ? 'slow' : 'offline';
  return 'failed';
}

/** The show never waits on AI: any failure, cap or silence takes the authored path. */
export async function aiOrAuthored<T>(call: () => Promise<T | null>, authored: () => T, onFallback: (reason: FallbackReason) => void): Promise<T> {
  try {
    const result = await call();
    if (result !== null) return result;
    // `withBackend` gives null when it can't get a device token: the backend can't be reached.
    onFallback('offline');
    return authored();
  } catch (cause) {
    onFallback(reasonFor(cause));
    return authored();
  }
}
