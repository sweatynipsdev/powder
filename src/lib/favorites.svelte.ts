// The resorts this phone follows, saved in localStorage. With storage blocked (private mode)
// stars still work for the session; they just aren't remembered.

import type { DataIndex } from '../../shared/types';
import { loadFavorites, toggleFavorite } from './favorites';

const KEY = 'powder.favorites';

export const favorites = $state({ ids: [] as string[], chosen: false, ready: false });

let known: DataIndex['resorts'] = [];

function readSaved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function apply(raw: string | null): void {
  const f = loadFavorites(raw, known);
  favorites.ids = f.ids;
  favorites.chosen = f.chosen;
  favorites.ready = true;
}

/** Called whenever a new index loads, so removed resorts drop out and new ones can be starred. */
export function initFavorites(index: DataIndex): void {
  known = index.resorts;
  // Choices made this session win over storage, which may be blocked.
  apply(favorites.chosen ? JSON.stringify(favorites.ids) : readSaved());
}

// Another window (the browser tab vs the home-screen app) changed the stars: follow it, so
// neither window saves over the other's choices with a stale list.
window.addEventListener('storage', (e) => {
  if (e.key === KEY && favorites.ready) apply(e.newValue);
});

export function toggle(id: string): void {
  // Before the resort list loads there's nothing to order against; a tap then would save an
  // empty list over the real one. StarButton stays hidden until ready, so this is a backstop.
  if (!favorites.ready) return;
  favorites.ids = toggleFavorite(
    favorites.ids,
    id,
    known.map((r) => r.id),
  );
  favorites.chosen = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(favorites.ids));
  } catch {
    // Storage blocked: kept for this session only.
  }
}

export const isFavorite = (id: string): boolean => favorites.ids.includes(id);

/** The resorts this phone follows, in resorts.json order. Reactive when used in $derived. */
export const followed = <T extends { id: string }>(resorts: T[]): T[] => resorts.filter((r) => favorites.ids.includes(r.id));
