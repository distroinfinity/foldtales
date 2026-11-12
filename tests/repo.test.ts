import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const at = (path: string) => `${root}${path}`;
// Tracked plus new files not yet committed, so the rules hold before a commit, not only after.
const tracked = [
  ...execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n'),
  ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n'),
].filter((f) => f && existsSync(at(f)));
const sources = (...dirs: string[]) => tracked.filter((f) => f.endsWith('.ts') && dirs.some((d) => f.startsWith(d)));
const read = (file: string) => readFileSync(at(file), 'utf8');

describe('repo layout', () => {
  test.each(['.claude', '.agents', '.cursor', '.codex', '.github', 'AGENTS.md', 'CLAUDE.md', 'pnpm-workspace.yaml'])('client carries no %s', (name) => {
    expect(existsSync(at(`client/${name}`))).toBe(false);
  });

  test('no env file is tracked', () => {
    expect(tracked.filter((f) => /(^|\/)\.env/.test(f))).toEqual([]);
  });
});

describe('source rules', () => {
  test('no package imports from spikes', () => {
    const offenders = sources('client/', 'backend/', 'contracts/', 'tools/', 'scripts/').filter((f) => /(from\s+|import\()['"][^'"]*spikes\//.test(read(f)));
    expect(offenders).toEqual([]);
  });

  test('client and contracts never read process.env', () => {
    const offenders = sources('client/src/', 'contracts/src/').filter((f) => read(f).includes('process.env'));
    expect(offenders).toEqual([]);
  });

  test('no flagship name in product source', () => {
    const offenders = sources('contracts/src/', 'backend/src/', 'client/src/').filter((f) => /\b(pip|wick|moth)\b/i.test(read(f)));
    expect(offenders).toEqual([]);
  });

  test('no literal port in dev config', () => {
    const offenders = [...sources('backend/src/'), 'client/vite.config.ts'].filter((f) => /port:\s*\d/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
