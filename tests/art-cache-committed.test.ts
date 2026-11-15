import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { planArtCache } from '../tools/art-build.ts';

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

describe('the committed art cache', () => {
  // Pages builds from the repo, and encoding everything there takes longer than its 20 minutes. So
  // every texture the site ships must have its blob committed: art changed without `pnpm art:cache`
  // fails here, before it can slow or break the deploy.
  test('holds every texture the shipped art needs', async () => {
    const { artFolders } = JSON.parse(readFileSync(root('client/public/show/manifest.json'), 'utf8')) as { artFolders: string[] };
    const plan = await planArtCache({ artRoot: root('art'), folders: artFolders, cacheDir: root('client/.art-cache') });
    expect(plan.outputs.size).toBeGreaterThan(50);
    expect(plan.missing.map((job) => job.label), 'run `pnpm art:cache` and commit client/.art-cache/blobs with your art').toEqual([]);
  }, 60_000);
});
