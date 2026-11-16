import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild, type Plugin } from 'vite';
import type { Precache } from '../src/offline/worker.ts';

const WORKER_SOURCE = fileURLToPath(new URL('../src/offline/worker.ts', import.meta.url));

/**
 * What the offline cache holds: everything the page and the book load, but not
 * - the worker itself and Pages' config files;
 * - source maps;
 * - sign-in pages (`auth/`, `link/`), which must always come from the network;
 * - the art's PNG sources, which the headset only fetches if a KTX2 texture fails (about 100 MB).
 */
export function isOffline(path: string): boolean {
  if (path === 'sw.js' || path === '_headers' || path === '_redirects') return false;
  if (path.endsWith('.map')) return false;
  if (path.startsWith('auth/') || path.startsWith('link/')) return false;
  if (path.startsWith('art/') && path.endsWith('.png')) return false;
  return true;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

/** The build's file list with each file's SHA-256, and a version made from the whole list. */
export function precacheFor(outDir: string, off = false): Precache {
  const files: Record<string, string> = {};
  const paths = filesUnder(outDir)
    .map((file) => relative(outDir, file).split(sep).join('/'))
    .filter(isOffline)
    .sort();
  for (const path of paths) files[path] = createHash('sha256').update(readFileSync(join(outDir, path))).digest('hex');
  const version = createHash('sha256')
    .update(off ? 'off\n' : '')
    .update(paths.map((path) => `${path} ${files[path]}`).join('\n'))
    .digest('hex')
    .slice(0, 16);
  return off ? { version, files: {}, off: true } : { version, files };
}

/** `worker.ts` compiled on its own, then started with the list inlined. */
export async function workerSource(precache: Precache): Promise<string> {
  const { code } = await transformWithEsbuild(readFileSync(WORKER_SOURCE, 'utf8'), WORKER_SOURCE, { format: 'iife', globalName: 'foldtalesWorker', target: 'es2022', loader: 'ts' });
  return `${code}\nfoldtalesWorker.start(self, ${JSON.stringify(precache)});\n`;
}

/**
 * Writes `sw.js` after everything else is on disk. Production builds only: dev and review builds
 * get no worker. With `off`, it writes the kill-switch worker, which removes itself and every cache.
 */
export function offlinePlugin({ enabled, off }: { enabled: boolean; off: boolean }): Plugin {
  return {
    name: 'tt-offline',
    apply: 'build',
    writeBundle: {
      sequential: true,
      order: 'post',
      async handler(options) {
        if (!enabled || !options.dir) return;
        const precache = precacheFor(options.dir, off);
        writeFileSync(join(options.dir, 'sw.js'), await workerSource(precache));
        const bytes = Object.keys(precache.files).reduce((sum, path) => sum + readFileSync(join(options.dir!, path)).length, 0);
        this.info(`offline: ${off ? 'kill switch' : `${Object.keys(precache.files).length} files, ${(bytes / 1e6).toFixed(1)} MB, version ${precache.version}`}`);
      },
    },
  };
}
