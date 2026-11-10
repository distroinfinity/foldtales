import { createHttpBackend, type BackendApi } from '@tabletop/contracts';

/** In dev, `/api` is proxied to this workspace's own backend. */
export const backend: BackendApi = createHttpBackend({
  baseUrl: import.meta.env.TT_PUBLIC_BACKEND_URL ?? '/api',
});
