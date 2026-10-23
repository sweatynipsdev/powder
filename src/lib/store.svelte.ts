// Loaded data shared across pages, so switching tabs or going back doesn't refetch.

import type { DataIndex, ResortData } from '../../shared/types';
import { loadIndex, loadResort } from './data';

export const store = $state({
  index: null as DataIndex | null,
  resorts: {} as Record<string, ResortData>,
  error: null as string | null,
});

let indexPromise: Promise<void> | null = null;
const resortPromises = new Map<string, Promise<void>>();

export function ensureIndex(): Promise<void> {
  indexPromise ??= loadIndex()
    .then((d) => {
      store.index = d;
    })
    .catch((e) => {
      store.error = String(e);
      indexPromise = null;
    });
  return indexPromise;
}

export function ensureResort(id: string): Promise<void> {
  let p = resortPromises.get(id);
  if (!p) {
    p = loadResort(id)
      .then((d) => {
        store.resorts[id] = d;
      })
      .catch((e) => {
        store.error = String(e);
        resortPromises.delete(id);
      });
    resortPromises.set(id, p);
  }
  return p;
}

/** Loads these resorts' full files (e.g. a phone's favorites), skipping any already loaded. */
export async function ensureResorts(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => ensureResort(id)));
}
