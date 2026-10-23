// The previous run's output: the source of stale fallbacks and (later) change detection.
// In Actions it's read from the live site; locally from the last files written.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataIndex, ResortData } from '../shared/types';
import { USER_AGENT } from './http';

export interface Previous {
  index: DataIndex | null;
  resorts: Map<string, ResortData>;
}

export const EMPTY_PREVIOUS: Previous = { index: null, resorts: new Map() };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function readJson<T>(path: string): T | null {
  try {
    return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null;
  } catch {
    return null;
  }
}

export async function loadPrevious(ids: string[], source: { url?: string; dir?: string }): Promise<Previous> {
  if (source.url) {
    const base = source.url.replace(/\/?$/, '/');
    const [index, ...resorts] = await Promise.all([
      getJson<DataIndex>(`${base}data.json`),
      ...ids.map((id) => getJson<ResortData>(`${base}resorts/${id}.json`)),
    ]);
    return { index, resorts: new Map(resorts.filter((r): r is ResortData => !!r).map((r) => [r.id, r])) };
  }
  if (source.dir) {
    const index = readJson<DataIndex>(join(source.dir, 'data.json'));
    const resorts = ids
      .map((id) => readJson<ResortData>(join(source.dir!, 'resorts', `${id}.json`)))
      .filter((r): r is ResortData => !!r);
    return { index, resorts: new Map(resorts.map((r) => [r.id, r])) };
  }
  return EMPTY_PREVIOUS;
}
