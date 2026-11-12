import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rig } from '../contracts/src/index.ts';
import { build, createServer } from 'vite';
import { afterAll, describe, expect, test } from 'vitest';
import { artPlugin, resolveArtPath } from '../client/vite/art-plugin.ts';

const artRoot = fileURLToPath(new URL('../art', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../client/public/show/manifest.json', import.meta.url), 'utf8')) as { artFolders: string[]; cast: Array<{ member: { rig: string } }> };
const stage = { cast: manifest.cast[0]!.member.rig };
const folders = manifest.artFolders;
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
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tt-art-root-')));
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
    const server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', plugins, server: { host: '127.0.0.1', ws: false } });
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

  test('with KTX2 on, a build also emits the compressed art, its index, and the transcoder', async () => {
    const out = mkdtempSync(join(tmpdir(), 'tt-art-ktx2-'));
    const cacheDir = mkdtempSync(join(tmpdir(), 'tt-art-cache-'));
    try {
      await build({ root, configFile: false, logLevel: 'silent', plugins: [artPlugin({ artRoot, folders: ['fx'], ktx2: { cacheDir } })], build: { outDir: out, emptyOutDir: true } });
      const index = JSON.parse(readFileSync(join(out, 'art', 'ktx2.json'), 'utf8'));
      expect(index.files['fx/smoke.png'].ktx2).toBe('ktx2/fx/smoke.ktx2');
      expect(existsSync(join(out, 'art', 'ktx2', 'fx', 'smoke.ktx2'))).toBe(true);
      expect(existsSync(join(out, 'basis', 'basis_transcoder.wasm'))).toBe(true);
      expect(existsSync(join(out, 'art', 'fx', 'smoke.png'))).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
      rmSync(cacheDir, { recursive: true, force: true });
    }
  }, 120_000);
});
