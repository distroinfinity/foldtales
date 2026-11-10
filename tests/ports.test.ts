import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { readPorts } from '../tools/ports.ts';

function portsFile(body: string): string {
  const file = join(mkdtempSync(join(tmpdir(), 'ports-')), '.env.ports');
  writeFileSync(file, body);
  return file;
}

const full = 'PORT_BASE=6100\nCLIENT_PORT=6100\nBACKEND_PORT=6101\n';

afterEach(() => {
  delete process.env.BACKEND_PORT;
});

test('reads both ports from the file', () => {
  expect(readPorts(portsFile(full))).toEqual({ CLIENT_PORT: 6100, BACKEND_PORT: 6101 });
});

test('an inherited environment variable does not win', () => {
  process.env.BACKEND_PORT = '1';
  expect(readPorts(portsFile(full)).BACKEND_PORT).toBe(6101);
});

test('a missing file throws and names setup.sh', () => {
  expect(() => readPorts('/nope/.env.ports')).toThrow(/\.superset\/setup\.sh/);
});

test('a missing key throws and names setup.sh', () => {
  expect(() => readPorts(portsFile('CLIENT_PORT=6100\n'))).toThrow(/\.superset\/setup\.sh/);
});

test('a non-numeric port throws', () => {
  expect(() => readPorts(portsFile('CLIENT_PORT=6100\nBACKEND_PORT=abc\n'))).toThrow(/BACKEND_PORT/);
});
