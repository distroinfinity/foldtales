import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'vite';
import { parseEnvValues, scanDir, type Needle } from './scan-secrets.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const client = join(root, 'client');
const CANARIES = ['ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_API_KEY', 'RUNWAYML_API_SECRET', 'TT_SECRET_CANARY'];

const needles: Needle[] = CANARIES.map((name) => ({ name, value: `canary-${randomBytes(16).toString('hex')}` }));
for (const { name, value } of needles) process.env[name] = value;

/** An app that never reads a variable would pass with any prefix, so this probe reads each one. */
const probe: Plugin = {
  name: 'tt-read-canaries',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/client/src/index.ts')) return null;
    const reads = CANARIES.map((name) => `import.meta.env.${name}`).join(', ');
    return `${code}\nconsole.log(${reads});\n`;
  },
};

// The client's Rollup input is relative to its own folder.
process.chdir(client);

const outDir = mkdtempSync(join(tmpdir(), 'tt-bundle-'));
let hits: { file: string; name: string }[];
try {
  await build({
    root: client,
    configFile: join(client, 'vite.config.ts'),
    logLevel: 'error',
    plugins: [probe],
    build: { outDir, emptyOutDir: true },
    ...(process.argv.includes('--weaken-prefix') ? { envPrefix: ['TT_PUBLIC_', 'VITE_'] } : {}),
  });
  hits = scanDir(outDir, [...needles, ...parseEnvValues(join(root, '.env.local'))], [
    { name: 'Anthropic key shape', re: /sk-ant-[\w-]{20,}/ },
    { name: 'Runway key shape', re: /key_[0-9a-f]{32,}/ },
  ]);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

if (hits.length > 0) {
  for (const hit of hits) console.error(`${hit.name} in ${hit.file}`);
  process.exit(1);
}
console.log('bundle clean');
