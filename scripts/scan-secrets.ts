import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface Needle {
  name: string;
  value: string;
}
export interface Shape {
  name: string;
  re: RegExp;
}
export interface Hit {
  file: string;
  name: string;
}

/** Shorter values are too likely to appear by chance. */
const MIN_NEEDLE = 8;

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

/** Reports names and files only, so a hit can be printed without printing the secret. */
export function scanDir(dir: string, needles: Needle[], shapes: Shape[]): Hit[] {
  const usable = needles.filter((n) => n.value.length >= MIN_NEEDLE);
  return filesUnder(dir).flatMap((path) => {
    const text = readFileSync(path, 'latin1');
    const file = relative(dir, path);
    return [
      ...usable.filter((n) => text.includes(n.value)).map((n) => ({ file, name: n.name })),
      ...shapes.filter((s) => s.re.test(text)).map((s) => ({ file, name: s.name })),
    ];
  });
}

export function parseEnvValues(path: string): Needle[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').flatMap((line) => {
    const match = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) return [];
    return [{ name: match[1]!, value: match[2]!.trim().replace(/^(['"])(.*)\1$/, '$2') }];
  });
}
