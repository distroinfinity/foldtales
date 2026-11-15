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
import { createLineCheck, createModerator, createPictureCheck } from './storyteller/moderate.ts';
import { createPainter } from './storyteller/paint.ts';
import { claudeSpend, spendingVoices, storytellerHandlers } from './storyteller/routes.ts';
import { openStories, readStoryLimits } from './storyteller/stories.ts';
import { createTranscriber, readListenPrompt } from './storyteller/listen.ts';
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

// The Storyteller's kill switch: off refuses every AI route, for guests and readers alike. Rollback
// is the Storyteller off, never sign-in off. Read on each call, so a restart isn't needed to read it.
const storytellerOn = () => process.env.TT_STORYTELLER !== 'off';
// Live painting stays off until it's switched on, and never runs without the picture check.
const paintingOn = () => process.env.TT_PAINTING === 'on';
const limits = readStoryLimits(process.env);
const stories = openStories(store.db, limits, now, () => !storytellerOn());

const accounts = await openAccounts(
  store.db,
  readAuthSettings(process.env, { dev, backendPort: ports?.BACKEND_PORT ?? null, clientOrigins: origins, log: console.log }),
  now,
  (userId) => stories.forget(userId),
);
// The AI is real once a key is set (backend only, never the client); without one it stays the mock.
const key = process.env.ANTHROPIC_API_KEY;
const claude = key ? createClaude(key, console.error, claudeSpend(stories)) : null;
// Voices (OpenAI) and listening (Groq's Whisper): the only two speech providers, each behind its own module.
const liveVoices = createVoices(process.env.OPENAI_API_KEY, readLiveVoices(join(process.cwd(), '..', 'art', 'voice', 'live.json')));
const groqKey = process.env.GROQ_API_KEY ?? process.env.GROQ_KEY;
const transcriber = createTranscriber(groqKey, { prompt: readListenPrompt(join(process.cwd(), '..', 'art', 'voice', 'listen.json')) });
const voices = spendingVoices(liveVoices, stories);
const anthropic = key ? new Anthropic({ apiKey: key, maxRetries: 0 }) : null;
const moderate = claude ? createModerator(claude) : undefined;
const checkLine = claude ? createLineCheck(claude) : async () => false;
// Live painting: run 013's recipe, its credits from the story store's lifetime pool.
const painter = createPainter({
  runwayKey: process.env.RUNWAYML_API_SECRET,
  claude,
  styleRefPath: join(process.cwd(), '..', 'art', 'runs', '013-live-props', 'style-ref.png'),
  stories,
  checkPicture: claude ? createPictureCheck(claude) : async () => false,
  checkLine,
  enabled: paintingOn,
  log: (m) => console.log(m),
});
const director =
  claude && anthropic && profile === 'normal'
    ? {
        planBeat: createPlanBeat(claude),
        ...storytellerHandlers({
          stories,
          anthropic,
          voices,
          painter,
          ...(moderate ? { moderate } : {}),
          checkLine,
          transcriber,
          storyVoices: (storyId) => spendingVoices(liveVoices, stories, storyId),
          paintsLeft: (story) => (paintingOn() && process.env.RUNWAYML_API_SECRET ? Math.max(0, limits.paintsPerStory - story.paints) : 0),
          log: (m) => console.log(m),
        }),
      }
    : {};
console.log(
  claude ? 'director and storyteller: claude' : 'director and storyteller: mock',
  process.env.OPENAI_API_KEY ? '; voices: openai' : '; voices: captions only',
  groqKey ? '; listening: groq' : '; listening: off (by hand)',
  storytellerOn() ? '; storyteller on' : '; storyteller OFF',
  paintingOn() ? '; painting on' : '; painting off',
);

const app = createApp(
  { ...createMockBackend(MOCK_PROFILES[profile as keyof typeof MOCK_PROFILES]), ...director, ...realRoutes(store, secret, now) },
  console.error,
  {
    beforeContract: browserAccess(process.env.TT_CLIENT_HOST, devOrigins),
    auth: (app) => accounts.mountAuth(app),
    afterContract: [guard(store, { secret, caps: readCaps(process.env), now, sessionUser: accounts.sessionUser, storytellerOn })],
    routes: (app) => accounts.mountRoutes(app),
    extend: adminTelemetry(store, process.env.TT_ADMIN_TOKEN),
  },
);
const { port, host } = resolveListen(argv, process.env, readPorts);

serve({ fetch: app.fetch, port, hostname: host }, () => {
  console.log(`backend on ${host}:${port}, mock profile ${profile}`);
});
