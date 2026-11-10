import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { parseEnvValues, scanDir } from '../scripts/scan-secrets.ts';

const secret = 'canary-value-1234567890';
const dir = () => mkdtempSync(join(tmpdir(), 'scan-'));
const needles = [{ name: 'API_KEY', value: secret }];
const shapes = [{ name: 'anthropic key shape', re: /sk-ant-[\w-]{20,}/ }];

test('finds a planted value and reports its name and file', () => {
  const root = dir();
  writeFileSync(join(root, 'bundle.js'), `const a = "${secret}";`);
  expect(scanDir(root, needles, shapes)).toEqual([{ file: 'bundle.js', name: 'API_KEY' }]);
});

test('the report never contains the value', () => {
  const root = dir();
  writeFileSync(join(root, 'bundle.js'), secret);
  expect(JSON.stringify(scanDir(root, needles, shapes))).not.toContain(secret);
});

test('finds a key shape with no needle', () => {
  const root = dir();
  writeFileSync(join(root, 'a.js'), `x = "sk-ant-${'a'.repeat(40)}"`);
  expect(scanDir(root, [], shapes)).toEqual([{ file: 'a.js', name: 'anthropic key shape' }]);
});

test('walks nested directories and sourcemaps', () => {
  const root = dir();
  mkdirSync(join(root, 'assets', 'deep'), { recursive: true });
  writeFileSync(join(root, 'assets', 'deep', 'index.js.map'), secret);
  expect(scanDir(root, needles, shapes)).toEqual([{ file: join('assets', 'deep', 'index.js.map'), name: 'API_KEY' }]);
});

test('a clean directory yields nothing', () => {
  const root = dir();
  writeFileSync(join(root, 'a.js'), 'const fine = 1;');
  expect(scanDir(root, needles, shapes)).toEqual([]);
});

test('values under 8 characters are skipped as needles', () => {
  const root = dir();
  writeFileSync(join(root, 'a.js'), 'true');
  expect(scanDir(root, [{ name: 'FLAG', value: 'true' }], [])).toEqual([]);
});

test('parseEnvValues reads names and values, with quotes, exports and comments', () => {
  const file = join(dir(), '.env');
  writeFileSync(file, `# note\nexport A="one two"\nB='three'\nC=four\n\nnot a line\n`);
  expect(parseEnvValues(file)).toEqual([
    { name: 'A', value: 'one two' },
    { name: 'B', value: 'three' },
    { name: 'C', value: 'four' },
  ]);
});

test('parseEnvValues on a missing file is empty', () => {
  expect(parseEnvValues('/nope/.env.local')).toEqual([]);
});
