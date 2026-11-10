import { serve } from '@hono/node-server';
import { createMockBackend, MOCK_PROFILES } from '@tabletop/contracts/mocks';
import { readPorts } from '../../tools/ports.ts';
import { createApp, resolveListen } from './app.ts';

const profile = process.env.MOCK_PROFILE ?? 'normal';
if (!Object.hasOwn(MOCK_PROFILES, profile)) {
  throw new Error(`MOCK_PROFILE must be one of ${Object.keys(MOCK_PROFILES).join(', ')}`);
}

const app = createApp(createMockBackend(MOCK_PROFILES[profile as keyof typeof MOCK_PROFILES]));
const { port, host } = resolveListen(process.argv.slice(2), process.env, readPorts);

serve({ fetch: app.fetch, port, hostname: host }, () => {
  console.log(`backend on ${host}:${port}, mock profile ${profile}`);
});
