import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.png': 'image/png',
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

/** Puts only the named art folders in front of the client, in dev and in the build. */
export function artPlugin({ artRoot, folders }: { artRoot: string; folders: string[] }): Plugin {
  return {
    name: 'tt-art',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = resolveArtPath(req.url ?? '', artRoot, folders);
        if (!file) {
          next();
          return;
        }
        res.setHeader('content-type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      // Emitted rather than copied, so the files follow the resolved outDir and survive its cleanup.
      for (const folder of folders) {
        for (const file of filesUnder(resolve(artRoot, folder))) {
          const fileName = join('art', relative(artRoot, file)).split(sep).join('/');
          this.emitFile({ type: 'asset', fileName, source: readFileSync(file) });
        }
      }
    },
  };
}
