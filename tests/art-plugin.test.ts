import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rig } from '../contracts/src/index.ts';
import { build, createServer } from 'vite';
import { afterAll, describe, expect, test } from 'vitest';
import { artPlugin, resolveArtPath } from '../client/vite/art-plugin.ts';

const artRoot = fileURLToPath(new URL('../art', import.meta.url));
const stage = JSON.parse(readFileSync(new URL('../client/public/stage.json', import.meta.url), 'utf8')) as { cast: string };
const folders = [stage.cast];
const rigUrl = `/art/${stage.cast}/rig.json`;

describe('the cast the stage names', () => {
  const rig = Rig.parse(JSON.parse(readFileSync(join(artRoot, stage.cast, 'rig.json'), 'utf8')));

  test('every file its rig names exists', () => {
    const files = [
      ...Object.values(rig.parts).map((part) => part.file),
      ...Object.keys(rig.head?.offsets ?? {}).map((name) => rig.head!.files.replace('<name>', name)),
    ];
    expect(files.length).toBeGreaterThan(5);
    expect(files.filter((file) => !existsSync(join(artRoot, stage.cast, file)))).toEqual([]);
  });
});

describe('resolveArtPath', () => {
  test('finds a file in an allowed folder', () => {
    expect(resolveArtPath(`${rigUrl}?t=1`, artRoot, folders)).toBe(join(artRoot, stage.cast, 'rig.json'));
  });

  test.each([
    ['another folder', '/art/runs/001-cast-model-test/plan.json'],
    ['climbing out', `/art/${stage.cast}/../../../.env.local`],
    ['encoded climbing', `/art/${stage.cast}/%2e%2e/%2e%2e/README.md`],
    ['an absolute path', '/art//etc/passwd'],
    ['a sibling with the same prefix', `/art/${stage.cast}-other/rig.json`],
    ['a folder itself', `/art/${stage.cast}`],
    ['a missing file', `/art/${stage.cast}/nope.png`],
    ['bad encoding', `/art/${stage.cast}/%E0%A4%A`],
    ['not art', '/src/index.ts'],
  ])('refuses %s', (_label, url) => {
    expect(resolveArtPath(url, artRoot, folders)).toBeNull();
  });
});

describe('in a real Vite', () => {
  const root = mkdtempSync(join(tmpdir(), 'tt-art-root-'));
  const outDir = mkdtempSync(join(tmpdir(), 'tt-art-out-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><script type="module" src="/main.js"></script>');
  writeFileSync(join(root, 'main.js'), 'console.log(1);');
  const plugins = [artPlugin({ artRoot, folders })];

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  });

  test('a build emits the cast into the resolved outDir, and nothing else of art', async () => {
    await build({ root, configFile: false, logLevel: 'silent', plugins, build: { outDir, emptyOutDir: true } });
    expect(existsSync(join(outDir, 'art', stage.cast, 'rig.json'))).toBe(true);
    expect(existsSync(join(outDir, 'art', 'runs'))).toBe(false);
    expect(existsSync(join(root, 'dist'))).toBe(false);
  });

  test('the dev server answers art and refuses the rest', async () => {
    const server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', plugins, server: { port: 0, ws: false } });
    await server.listen();
    try {
      const { port } = server.httpServer!.address() as AddressInfo;
      const rig = await fetch(`http://127.0.0.1:${port}${rigUrl}`);
      expect(rig.status).toBe(200);
      expect(rig.headers.get('content-type')).toContain('application/json');
      expect((await fetch(`http://127.0.0.1:${port}/art/README.md`)).status).toBe(404);
    } finally {
      await server.close();
    }
  });
});
