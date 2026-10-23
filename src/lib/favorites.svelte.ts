// The resorts this phone follows, saved in localStorage. With storage blocked (private mode)
// stars still work for the session; they just aren't remembered.

import type { DataIndex } from '../../shared/types';
import { loadFavorites, toggleFavorite } from './favorites';

const KEY = 'powder.favorites';

export const favorites = $state({ ids: [] as string[], chosen: false, ready: false });

let order: string[] = [];

function readSaved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Called whenever a new index loads, so removed resorts drop out and new ones can be starred. */
export function initFavorites(index: DataIndex): void {
  order = index.resorts.map((r) => r.id);
  // Choices made this session win over storage, which may be blocked.
  const raw = favorites.chosen ? JSON.stringify(favorites.ids) : readSaved();
  const f = loadFavorites(raw, index.resorts);
  favorites.ids = f.ids;
  favorites.chosen = f.chosen;
  favorites.ready = true;
}

export function toggle(id: string): void {
  favorites.ids = toggleFavorite(favorites.ids, id, order);
  favorites.chosen = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(favorites.ids));
  } catch {
    // Storage blocked: kept for this session only.
  }
}

export const isFavorite = (id: string): boolean => favorites.ids.includes(id);
