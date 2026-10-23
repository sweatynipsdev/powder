import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/http', import.meta.url));

const index: Record<string, string> = JSON.parse(readFileSync(join(FIXTURE_DIR, 'index.json'), 'utf8'));

/** Body of the first recorded response whose "METHOD url" matches. */
export function fixtureText(match: RegExp | string): string {
  const entry = Object.entries(index).find(([, req]) => (typeof match === 'string' ? req.includes(match) : match.test(req)));
  if (!entry) throw new Error(`no fixture matching ${match}`);
  const stored = JSON.parse(gunzipSync(readFileSync(join(FIXTURE_DIR, `${entry[0]}.json.gz`))).toString('utf8'));
  return stored.data;
}

export function fixtureJson<T = unknown>(match: RegExp | string): T {
  return JSON.parse(fixtureText(match)) as T;
}

export const recordedAt = new Date(JSON.parse(readFileSync(join(FIXTURE_DIR, 'meta.json'), 'utf8')).recordedAt);
