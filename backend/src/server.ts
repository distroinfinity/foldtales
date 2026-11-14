import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { BackendError } from '@tabletop/contracts';
import { createMockBackend, MOCK_PROFILES } from '@tabletop/contracts/mocks';
import { readPorts } from '../../tools/ports.ts';
import { createApp, resolveListen } from './app.ts';
import { openAccounts, readAuthSettings } from './auth/index.ts';
import Anthropic from '@anthropic-ai/sdk';
import { createPlanBeat } from './director/beat.ts';
import { createClaude } from './director/claude.ts';
import { createModerator } from './storyteller/moderate.ts';
import { createPainter } from './storyteller/paint.ts';
import { storyTurn } from './storyteller/turn.ts';
import { createVoices, readLiveVoices } from './storyteller/voices.ts';
import { guard, readCaps } from './guard.ts';
import { realRoutes } from './real-routes.ts';
import { openStore } from './store.ts';
import { adminTelemetry, browserAccess, clientOrigins } from './web.ts';

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

// The dev client's own addresses, so its pages can sign in through the proxy or directly.
const ports = dev ? readPorts() : null;
// The IWSDK dev server serves https (WebXR needs it), and the plain Vite one http.
const devOrigins = ports ? ['https', 'http'].flatMap((scheme) => [`${scheme}://127.0.0.1:${ports.CLIENT_PORT}`, `${scheme}://localhost:${ports.CLIENT_PORT}`]) : [];
const origins = clientOrigins(process.env.TT_CLIENT_HOST, devOrigins);
const accounts = await openAccounts(
  store.db,
  readAuthSettings(process.env, { dev, backendPort: ports?.BACKEND_PORT ?? null, clientOrigins: origins, log: console.log }),
  now,
);
// The director is real once a key is set (backend only, never the client); without one it stays the mock.
const key = process.env.ANTHROPIC_API_KEY;
const claude = key ? createClaude(key) : null;
const voices = createVoices(process.env.ELEVENLABS_API_KEY, readLiveVoices(join(process.cwd(), '..', 'art', 'voice', 'live.json')));
const anthropic = key ? new Anthropic({ apiKey: key, maxRetries: 0 }) : null;
const moderate = claude ? createModerator(claude) : undefined;
// Live painting: run 013's recipe, capped in credits for this process (owner: 100–150 in all).
const painter = createPainter({
  runwayKey: process.env.RUNWAYML_API_SECRET,
  claude,
  styleRefPath: join(process.cwd(), '..', 'art', 'runs', '013-live-props', 'style-ref.png'),
  creditCap: Number(process.env.PAINT_CREDIT_CAP ?? 100),
  log: (m) => console.log(m),
});
const director =
  claude && anthropic && profile === 'normal'
    ? {
        planBeat: createPlanBeat(claude),
        storyTurn: (request: Parameters<typeof storyTurn>[0]) =>
          storyTurn(request, { anthropic, voices, moderate, log: (m) => console.log(m), paint: (sessionId, description, objectId) => painter.start({ sessionId, description, image: null }, objectId) }),
        paintProp: async (request: Parameters<typeof painter.start>[0]) => ({ jobId: painter.start(request) }),
        paintResult: async ({ jobId }: { jobId: string }) => painter.result(jobId),
        // A single-use token for ElevenLabs' realtime speech to text: the headset listens without the key.
        speechToken: async () => {
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (!apiKey) throw new BackendError('upstream_failed', 'listening is off', false);
          const response = await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', { method: 'POST', headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(6000) });
          const body = (await response.json().catch(() => ({}))) as { token?: string };
          if (!response.ok || !body.token) throw new BackendError('upstream_failed', `token ${response.status}`, true);
          return { provider: 'elevenlabs', token: body.token, expiresAt: new Date(Date.now() + 14 * 60_000).toISOString() };
        },
        soundEffect: async ({ description, seconds }: { description: string; seconds: number }) => (await voices.sound(description, seconds)) ?? { url: null, durationMs: seconds * 1000 },
      }
    : {};
console.log(claude ? 'director and storyteller: claude' : 'director and storyteller: mock', process.env.ELEVENLABS_API_KEY ? '; voices: elevenlabs' : '; voices: captions only');

const app = createApp(
  { ...createMockBackend(MOCK_PROFILES[profile as keyof typeof MOCK_PROFILES]), ...director, ...realRoutes(store, secret, now) },
  console.error,
  {
    beforeContract: browserAccess(process.env.TT_CLIENT_HOST, devOrigins),
    auth: (app) => accounts.mountAuth(app),
    afterContract: [guard(store, { secret, caps: readCaps(process.env), now, sessionUser: accounts.sessionUser, requireSignIn: process.env.TT_ACCOUNTS === 'on' })],
    routes: (app) => accounts.mountRoutes(app),
    extend: adminTelemetry(store, process.env.TT_ADMIN_TOKEN),
  },
);
const { port, host } = resolveListen(argv, process.env, readPorts);

serve({ fetch: app.fetch, port, hostname: host }, () => {
  console.log(`backend on ${host}:${port}, mock profile ${profile}`);
});
