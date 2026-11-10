import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface Ports {
  CLIENT_PORT: number;
  BACKEND_PORT: number;
}

const DEFAULT_FILE = fileURLToPath(new URL('../.env.ports', import.meta.url));
const SETUP_HINT = 'run .superset/setup.sh to give this workspace its ports';

/**
 * Reads this workspace's own port file. Parsed by hand because `--env-file` and
 * `process.loadEnvFile` both let an inherited variable win, and another workspace's
 * BACKEND_PORT in the shell must never decide where this one listens.
 */
export function readPorts(file: string = DEFAULT_FILE): Ports {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`${file} is missing: ${SETUP_HINT}`);
  }
  const values = new Map(
    text
      .split('\n')
      .map((line) => line.trim().match(/^([A-Z_]+)=(.*)$/))
      .filter((match) => match !== null)
      .map((match) => [match[1], match[2]] as const),
  );
  const port = (key: keyof Ports): number => {
    const raw = values.get(key);
    if (raw === undefined) throw new Error(`${file} has no ${key}: ${SETUP_HINT}`);
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${file} has a bad ${key}: ${SETUP_HINT}`);
    return parsed;
  };
  return { CLIENT_PORT: port('CLIENT_PORT'), BACKEND_PORT: port('BACKEND_PORT') };
}
