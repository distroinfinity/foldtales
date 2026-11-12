import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { buildArtCache } from '../../tools/art-build.ts';

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.ktx2': 'image/ktx2',
  '.mp3': 'audio/mpeg',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
};

const isFile = (path: string): boolean => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

/** The file a `/art/...` URL means, or null unless it's a real file inside an allowed folder. */
export function resolveArtPath(url: string, artRoot: string, folders: string[]): string | null {
  const path = url.split(/[?#]/, 1)[0] ?? '';
  if (!path.startsWith('/art/')) return null;
  let wanted: string;
  try {
    wanted = decodeURIComponent(path.slice('/art/'.length));
  } catch {
    return null;
  }
  if (wanted.includes('\0') || wanted.startsWith('/')) return null;
  const file = resolve(artRoot, wanted);
  const allowed = folders.some((folder) => file.startsWith(resolve(artRoot, folder) + sep));
  return allowed && isFile(file) ? file : null;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

/** Three's Basis transcoder, which the KTX2 loader runs in a worker. Served at `/basis/`. */
function basisDir(): string {
  const require = createRequire(import.meta.url);
  // three's exports hide package.json; its main entry lives in build/.
  const main = require.resolve('three', { paths: [join(dirname(new URL(import.meta.url).pathname), '..')] });
  return join(dirname(dirname(main)), 'examples/jsm/libs/basis');
}

export interface ArtPluginOptions {
  artRoot: string;
  folders: string[];
  /** Compress the art to KTX2, with a cache keyed by content. Off unless given. */
  ktx2?: { cacheDir: string };
}

/** Puts only the named art folders in front of the client, in dev and in the build. */
export function artPlugin({ artRoot, folders, ktx2 }: ArtPluginOptions): Plugin {
  const fromCache = (url: string): string | null => {
    if (!ktx2) return null;
    const path = url.split(/[?#]/, 1)[0] ?? '';
    if (path === '/art/ktx2.json') return join(ktx2.cacheDir, 'ktx2.json');
    if (!path.startsWith('/art/ktx2/') || path.includes('..')) return null;
    const file = join(ktx2.cacheDir, path.slice('/art/'.length));
    return file.endsWith('.ktx2') && isFile(file) ? file : null;
  };
  const fromBasis = (url: string): string | null => {
    if (!ktx2) return null;
    const path = url.split(/[?#]/, 1)[0] ?? '';
    const name = path.startsWith('/basis/') ? path.slice('/basis/'.length) : '';
    return name === 'basis_transcoder.js' || name === 'basis_transcoder.wasm' ? join(basisDir(), name) : null;
  };

  return {
    name: 'tt-art',
    configureServer(server) {
      // In dev the compressed art builds in the background. Until its index exists, the client uses PNG.
      if (ktx2) void buildArtCache({ artRoot, folders, cacheDir: ktx2.cacheDir }).catch((cause) => server.config.logger.warn(`ktx2: ${String(cause)}`));
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const file = resolveArtPath(url, artRoot, folders) ?? fromCache(url) ?? fromBasis(url);
        if (!file || !existsSync(file)) {
          next();
          return;
        }
        res.setHeader('content-type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    async generateBundle() {
      // Emitted rather than copied, so the files follow the resolved outDir and survive its cleanup.
      for (const folder of folders) {
        for (const file of filesUnder(resolve(artRoot, folder))) {
          const fileName = join('art', relative(artRoot, file)).split(sep).join('/');
          this.emitFile({ type: 'asset', fileName, source: readFileSync(file) });
        }
      }
      if (!ktx2) return;
      const index = await buildArtCache({ artRoot, folders, cacheDir: ktx2.cacheDir });
      this.emitFile({ type: 'asset', fileName: 'art/ktx2.json', source: JSON.stringify(index) });
      const compressed = [...Object.values(index.files).map((f) => f.ktx2), ...Object.values(index.atlases).map((a) => a.ktx2)];
      for (const rel of compressed) this.emitFile({ type: 'asset', fileName: `art/${rel}`, source: readFileSync(join(ktx2.cacheDir, rel)) });
      for (const name of ['basis_transcoder.js', 'basis_transcoder.wasm']) this.emitFile({ type: 'asset', fileName: `basis/${name}`, source: readFileSync(join(basisDir(), name)) });
    },
  };
}
