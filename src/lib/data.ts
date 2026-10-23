// The app's only data source: the static JSON the pipeline publishes. The service worker
// serves it network-first and falls back to the last cached copy when offline.

import type { DataIndex, ResortData } from '../../shared/types';

const base = `${import.meta.env.BASE_URL}data/`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(base + path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const loadIndex = () => getJson<DataIndex>('data.json');
export const loadResort = (id: string) => getJson<ResortData>(`resorts/${id}.json`);
