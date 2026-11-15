import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { noticesText, packageDirOf, readNotice } from '../client/vite/notices-plugin.ts';

describe('third-party notices', () => {
  test('finds the package a bundled module came from, scoped or not', () => {
    const nm = `${sep}repo${sep}node_modules${sep}`;
    expect(packageDirOf(`${nm}.pnpm${sep}three@1${sep}node_modules${sep}three${sep}build${sep}three.module.js`)).toBe(`${sep}repo${sep}node_modules${sep}.pnpm${sep}three@1${sep}node_modules${sep}three`);
    expect(packageDirOf(`${nm}@fontsource${sep}fraunces${sep}files${sep}x.woff2?url`)).toBe(`${sep}repo${sep}node_modules${sep}@fontsource${sep}fraunces`);
    expect(packageDirOf(`${sep}repo${sep}client${sep}src${sep}main.ts`)).toBeNull();
  });

  const dir = mkdtempSync(join(tmpdir(), 'tt-notices-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('carries the licence text verbatim, and says so when a package ships none', () => {
    mkdirSync(join(dir, 'a'));
    writeFileSync(join(dir, 'a', 'package.json'), JSON.stringify({ name: 'a', version: '1.0.0', license: 'MIT' }));
    writeFileSync(join(dir, 'a', 'LICENSE'), 'MIT License\n\nCopyright (c) A');
    mkdirSync(join(dir, 'b'));
    writeFileSync(join(dir, 'b', 'package.json'), JSON.stringify({ name: 'b', version: '2.0.0' }));
    const text = noticesText([readNotice(join(dir, 'a'))!, readNotice(join(dir, 'b'))!]);
    expect(text).toContain('- a 1.0.0 (MIT)');
    expect(text).toContain('Copyright (c) A');
    expect(text).toContain('- b 2.0.0 (none published)');
    expect(text).toContain('ships no licence file');
  });
});
