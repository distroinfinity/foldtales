import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import type { Plugin } from 'vite';

/**
 * `notices.txt`: the licence text of every third-party package whose code or files the site
 * ships, taken from the modules the build actually bundled, plus files copied in outside the
 * bundle (the Basis transcoder). Linked from About. Built every time, so it can't drift.
 */

export interface Notice {
  name: string;
  version: string;
  license: string;
  /** The package's own licence and notice files, verbatim. Empty if it ships none. */
  texts: Array<{ file: string; text: string }>;
}

const LICENCE_FILE = /^(licen[cs]e|copying|notice|ofl)(\.(md|txt))?$/i;

/** The package directory a module id belongs to, or null if it isn't from node_modules. */
export function packageDirOf(id: string): string | null {
  const path = id.split('?')[0]!.replace(/^\0+/, '');
  const at = path.lastIndexOf(`${sep}node_modules${sep}`);
  if (at < 0) return null;
  const rest = path.slice(at + `${sep}node_modules${sep}`.length).split(sep);
  const parts = rest[0]!.startsWith('@') ? rest.slice(0, 2) : rest.slice(0, 1);
  return join(path.slice(0, at), 'node_modules', ...parts);
}

export function readNotice(dir: string): Notice | null {
  const manifest = join(dir, 'package.json');
  if (!existsSync(manifest)) return null;
  const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string; version?: string; license?: string | { type?: string } };
  const texts = readdirSync(dir)
    .filter((file) => LICENCE_FILE.test(file))
    .sort()
    .map((file) => ({ file, text: readFileSync(join(dir, file), 'utf8').trim() }));
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'none published');
  return { name: pkg.name ?? dir, version: pkg.version ?? '', license, texts };
}

export function noticesText(notices: Notice[]): string {
  const rule = '='.repeat(72);
  const head = [
    'Foldtales: third-party notices',
    '',
    'Foldtales includes the following open-source software and fonts. Each is listed with its',
    'licence, and the licence and notice text it ships with, as its licence asks.',
    '',
    ...notices.map((n) => `- ${[n.name, n.version].filter(Boolean).join(' ')} (${n.license})`),
    '',
  ];
  const bodies = notices.flatMap((n) => [rule, [n.name, n.version].filter(Boolean).join(' '), `Licence: ${n.license}`, rule, '', ...(n.texts.length > 0 ? n.texts.map((t) => `${t.text}\n`) : [`(This package ships no licence file, and its licence is: ${n.license}.)\n`])]);
  return [...head, ...bodies].join('\n');
}

/** Extra files copied into the site outside the bundle, with where their licence lives. */
export interface Extra {
  name: string;
  version: string;
  license: string;
  /** Licence files to include, as absolute paths. */
  files: string[];
}

/**
 * `extras`: things shipped outside the bundle, or copied into our source (adapted components).
 * `fallbacks`: licence files, kept in `client/vite/licences/`, for packages that ship none of their own.
 */
export function noticesPlugin({ extras = () => [], fallbacks = {} }: { extras?: () => Extra[]; fallbacks?: Record<string, string[]> } = {}): Plugin {
  return {
    name: 'tt-notices',
    apply: 'build',
    generateBundle() {
      const dirs = new Set<string>();
      for (const id of this.getModuleIds()) {
        const dir = packageDirOf(id);
        if (dir) dirs.add(dir);
      }
      const byName = new Map<string, Notice>();
      for (const dir of dirs) {
        const notice = readNotice(dir);
        // Our own workspace packages aren't third-party.
        if (!notice || notice.name.startsWith('@tabletop/')) continue;
        if (notice.texts.length === 0 && fallbacks[notice.name]) notice.texts = fallbacks[notice.name]!.map((file) => ({ file: file.split(sep).pop()!, text: readFileSync(file, 'utf8').trim() }));
        byName.set(`${notice.name}@${notice.version}`, notice);
      }
      for (const extra of extras()) {
        byName.set(`${extra.name}@${extra.version}`, {
          name: extra.name,
          version: extra.version,
          license: extra.license,
          texts: extra.files.map((file) => ({ file: file.split(sep).pop()!, text: readFileSync(file, 'utf8').trim() })),
        });
      }
      const notices = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
      this.emitFile({ type: 'asset', fileName: 'notices.txt', source: noticesText(notices) });
      const bare = notices.filter((n) => n.texts.length === 0).map((n) => n.name);
      if (bare.length > 0) this.warn(`notices: no licence file shipped by ${bare.join(', ')}`);
    },
  };
}

