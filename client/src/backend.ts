import { BackendError, createHttpBackend, type BackendApi } from '@tabletop/contracts';

const TOKEN_KEY = 'tt.device';
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;
const DEADLINE_MS = 8000;

interface Stored {
  token: string;
  expiresAt: string;
}

export interface BackendAccessDeps {
  baseUrl: string;
  fetch: typeof fetch;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  now: () => number;
}

export interface BackendAccess {
  /** Runs `call` with a token, renewing once if it's refused. Null when the backend can't be reached. */
  withBackend<T>(call: (api: BackendApi) => Promise<T>): Promise<T | null>;
}

/** The HTTP client has no deadline of its own, and a hung request must never hold anything up. */
export function withDeadline(send: typeof fetch, ms: number = DEADLINE_MS): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => send(input, { ...init, signal: AbortSignal.timeout(ms) })) as typeof fetch;
}

export function createBackendAccess(deps: BackendAccessDeps): BackendAccess {
  let memory: Stored | null = null;
  let pending: Promise<Stored | null> | null = null;

  const client = (token?: string): BackendApi => createHttpBackend({ baseUrl: deps.baseUrl, token, fetch: deps.fetch });

  function read(): Stored | null {
    if (memory) return memory;
    try {
      const raw = deps.storage.getItem(TOKEN_KEY);
      memory = raw ? (JSON.parse(raw) as Stored) : null;
    } catch {
      memory = null;
    }
    return memory;
  }

  function write(stored: Stored): void {
    memory = stored;
    try {
      deps.storage.setItem(TOKEN_KEY, JSON.stringify(stored));
    } catch {
      // Without storage the token lasts for this page, which is fine.
    }
  }

  /** One request at a time. Sending the old token renews the same device. */
  function refresh(oldToken: string | undefined): Promise<Stored | null> {
    pending ??= client(oldToken)
      .issueDevice({})
      .then(({ token, expiresAt }) => {
        const stored = { token, expiresAt };
        write(stored);
        return stored;
      })
      .catch(() => null)
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  async function current(): Promise<Stored | null> {
    const stored = read();
    if (stored && Date.parse(stored.expiresAt) - deps.now() > RENEW_BEFORE_MS) return stored;
    return refresh(stored?.token);
  }

  return {
    async withBackend(call) {
      const used = await current();
      if (!used) return null;
      try {
        return await call(client(used.token));
      } catch (cause) {
        if (!(cause instanceof BackendError) || cause.code !== 'unauthorized') throw cause;
        // Another caller may already have renewed while this one was failing.
        const latest = read();
        const renewed = latest && latest.token !== used.token ? latest : await refresh(used.token);
        if (!renewed) return null;
        return call(client(renewed.token));
      }
    },
  };
}
