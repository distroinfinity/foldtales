import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createMockBackend, MOCK_PROFILES } from '@tabletop/contracts/mocks';
import { readPorts } from '../../tools/ports.ts';
import { createApp, resolveListen } from './app.ts';
import { createPlanBeat } from './director/beat.ts';
import { createClaude } from './director/claude.ts';
import { guard, readCaps } from './guard.ts';
import { realRoutes } from './real-routes.ts';
import { openStore } from './store.ts';
import { adminTelemetry, browserAccess } from './web.ts';

const profile = process.env.MOCK_PROFILE ?? 'normal';
if (!Object.hasOwn(MOCK_PROFILES, profile)) {
  throw new Error(`MOCK_PROFILE must be one of ${Object.keys(MOCK_PROFILES).join(', ')}`);
}

const argv = process.argv.slice(2);
const dev = argv.includes('--dev');
const secret = process.env.TT_TOKEN_SECRET ?? (dev ? randomBytes(32).toString('hex') : undefined);
if (!secret) throw new Error('production needs TT_TOKEN_SECRET');

const dataDir = process.env.DATA_DIR ?? join(process.cwd(), '.data');
mkdirSync(dataDir, { recursive: true });
const store = openStore(join(dataDir, 'backend.db'));
const now = () => new Date();

// The director is real once a key is set (backend only, never the client); without one it stays the mock.
const key = process.env.ANTHROPIC_API_KEY;
const director = key && profile === 'normal' ? { planBeat: createPlanBeat(createClaude(key)) } : {};
console.log(director.planBeat ? 'director: claude' : 'director: mock');

const app = createApp(
  { ...createMockBackend(MOCK_PROFILES[profile as keyof typeof MOCK_PROFILES]), ...director, ...realRoutes(store, secret, now) },
  console.error,
  {
    beforeContract: browserAccess(process.env.TT_CLIENT_HOST),
    afterContract: [guard(store, { secret, caps: readCaps(process.env), now })],
    extend: adminTelemetry(store, process.env.TT_ADMIN_TOKEN),
  },
);
const { port, host } = resolveListen(argv, process.env, readPorts);

serve({ fetch: app.fetch, port, hostname: host }, () => {
  console.log(`backend on ${host}:${port}, mock profile ${profile}`);
});
