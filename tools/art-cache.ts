/**
 * Brings the committed art cache (`client/.art-cache/blobs/`) up to date with the shipped art:
 * encodes any texture it lacks, then lists what changed, to commit with the art.
 *
 *   pnpm art:cache           encode what's missing
 *   pnpm art:cache --prune   also delete blobs no art uses any more (lane E, before release)
 *
 * The art folders are the manifest's (`client/public/show/manifest.json`), so this ships exactly what
 * the site serves. No source PNG goes in the cache: only the KTX2 the headset loads.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildArtCache, planArtCache } from './art-build.ts';

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const artRoot = root('art');
const cacheDir = root('client/.art-cache');
const { artFolders } = JSON.parse(readFileSync(root('client/public/show/manifest.json'), 'utf8')) as { artFolders: string[] };
const prune = process.argv.includes('--prune');

const before = await planArtCache({ artRoot, folders: artFolders, cacheDir });
const started = Date.now();
await buildArtCache({ artRoot, folders: artFolders, cacheDir, prune, log: (line) => (line.startsWith('encoding ') ? console.log(line) : undefined) });
console.log(`${before.missing.length} texture(s) encoded in ${Math.round((Date.now() - started) / 1000)} s; ${before.outputs.size} in all.`);
if (before.missing.length > 0 || prune) console.log('Commit them with your art:  git add client/.art-cache/blobs');
